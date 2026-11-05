<?php
declare(strict_types=1);

header('X-Robots-Tag: noindex, nofollow');
header('Cache-Control: no-store, no-cache, must-revalidate');

if (!function_exists('str_contains')) {
    function str_contains(string $haystack, string $needle): bool {
        return $needle === '' || strpos($haystack, $needle) !== false;
    }
}

$accept = strtolower((string)($_SERVER['HTTP_ACCEPT'] ?? ''));
$wantsJson = str_contains($accept, 'application/json') || (($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') === 'fetch');

$respond = static function (int $status, array $payload, string $redirect = '/contact/') use ($wantsJson): void {
    http_response_code($status);
    if ($wantsJson) {
        header('Content-Type: application/json; charset=UTF-8');
        echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }
    header('Location: ' . $redirect, true, 303);
    exit;
};

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    $respond(405, ['ok' => false, 'error' => 'Method not allowed.'], '/contact/');
}

$cleanLine = static function (mixed $v, int $maxLen = 200): string {
    if (!is_scalar($v)) {
        return '';
    }
    $s = trim((string)$v);
    $s = preg_replace('/[\r\n\0\x0B\x00-\x1F\x7F]+/u', ' ', $s) ?? '';
    $s = preg_replace('/\s{2,}/u', ' ', $s) ?? '';
    return mb_substr(trim($s), 0, $maxLen, 'UTF-8');
};

$cleanText = static function (mixed $v, int $maxLen = 6000): string {
    if (!is_scalar($v)) {
        return '';
    }
    $s = str_replace(["\r\n", "\r", "\0"], ["\n", "\n", ''], trim((string)$v));
    $s = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]+/u', '', $s) ?? '';
    return mb_substr(trim($s), 0, $maxLen, 'UTF-8');
};

$honeypot = $cleanLine($_POST['website'] ?? '', 200);
if ($honeypot !== '') {
    $respond(200, ['ok' => true], '/contact/?sent=1#contact-form');
}

$tsRaw = $cleanLine($_POST['ts'] ?? '', 30);
if ($tsRaw !== '' && ctype_digit($tsRaw)) {
    $elapsedMs = (int)round(microtime(true) * 1000) - (int)$tsRaw;
    if ($elapsedMs >= 0 && $elapsedMs < 1800) {
        $respond(200, ['ok' => true], '/contact/?sent=1#contact-form');
    }
}

$rawIp = (string)($_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
$ip = trim(explode(',', $rawIp)[0]);
$rlFile = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'agrecir_rl_' . hash('sha256', $ip . '|agrecir_contact_v1') . '.json';
$now = time();
$windowSec = 900;
$maxHits = 5;

$fp = @fopen($rlFile, 'c+');
if ($fp !== false) {
    if (flock($fp, LOCK_EX)) {
        $raw = stream_get_contents($fp);
        $hits = is_string($raw) && $raw !== '' ? json_decode($raw, true) : [];
        if (!is_array($hits)) {
            $hits = [];
        }
        $hits = array_values(array_filter($hits, static fn($t): bool => is_int($t) && ($now - $t) < $windowSec));
        if (count($hits) >= $maxHits) {
            flock($fp, LOCK_UN);
            fclose($fp);
            $respond(429, [
                'ok' => false,
                'error' => 'Something went wrong on our side. Please try again, or email info@agrecir.com.',
            ], '/contact/?error=1#contact-form');
        }
        $hits[] = $now;
        ftruncate($fp, 0);
        rewind($fp);
        fwrite($fp, json_encode($hits));
        fflush($fp);
        flock($fp, LOCK_UN);
    }
    fclose($fp);
}

$name = $cleanLine($_POST['name'] ?? '', 160);
$organisation = $cleanLine($_POST['organisation'] ?? '', 200);
$email = $cleanLine($_POST['email'] ?? '', 254);
$phone = $cleanLine($_POST['phone'] ?? '', 60);
$country = $cleanLine($_POST['country'] ?? '', 120);
$orgType = $cleanLine($_POST['type'] ?? '', 120);

$rawInterests = $_POST['interest'] ?? [];
$interests = [];
if (is_array($rawInterests)) {
    foreach (array_slice($rawInterests, 0, 15) as $item) {
        $val = $cleanLine($item, 120);
        if ($val !== '') {
            $interests[] = $val;
        }
    }
} elseif (is_scalar($rawInterests)) {
    $val = $cleanLine($rawInterests, 120);
    if ($val !== '') {
        $interests[] = $val;
    }
}

$message = $cleanText($_POST['message'] ?? '', 6000);
$updates = isset($_POST['updates']) && $_POST['updates'] !== '' && $_POST['updates'] !== '0';

$errors = [];
if ($name === '') {
    $errors['name'] = 'Please add your name.';
}
if ($email === '' || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
    $errors['email'] = 'Please enter a valid email address.';
}
if ($message === '') {
    $errors['message'] = 'Please tell us a little about your enquiry.';
}

if ($errors !== []) {
    $respond(422, ['ok' => false, 'errors' => $errors], '/contact/?error=1#contact-form');
}

$cfg = [];
$candidates = [
    dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'agrecir-mail-config.php',
    dirname(__DIR__, 1) . DIRECTORY_SEPARATOR . 'agrecir-mail-config.php',
    __DIR__ . DIRECTORY_SEPARATOR . 'agrecir-mail-config.php',
];
foreach ($candidates as $cand) {
    if (@is_file($cand)) {
        $loaded = @require $cand;
        if (is_array($loaded)) {
            $cfg = $loaded;
            break;
        }
    }
}

$toEmail = $cleanLine($cfg['to_email'] ?? 'info@agrecir.com', 254);
$fromEmail = $cleanLine($cfg['from_email'] ?? 'info@agrecir.com', 254);
$fromName = $cleanLine($cfg['from_name'] ?? 'AgReCir Website', 120);

$subjectTag = $orgType !== '' ? $orgType : 'Website enquiry';
$subjectText = '[AgReCir Enquiry] ' . $name . ($organisation !== '' ? ' (' . $organisation . ')' : '') . ' — ' . $subjectTag;
$encodedSubject = '=?UTF-8?B?' . base64_encode($subjectText) . '?=';

$lines = [
    'New website enquiry received via agrecir.com',
    '------------------------------------------------------------',
    'Name:           ' . $name,
    'Organisation:   ' . ($organisation !== '' ? $organisation : '—'),
    'Email:          ' . $email,
    'Phone/WhatsApp: ' . ($phone !== '' ? $phone : '—'),
    'Country:        ' . ($country !== '' ? $country : '—'),
    'Organisation type: ' . ($orgType !== '' ? $orgType : '—'),
    'Interested in:  ' . ($interests !== [] ? implode(', ', $interests) : '—'),
    'News & updates: ' . ($updates ? 'Yes (opted in)' : 'No'),
    'Submitted (UTC): ' . gmdate('Y-m-d H:i:s') . ' UTC',
    '------------------------------------------------------------',
    '',
    'Message:',
    $message,
    '',
];
$body = implode("\r\n", $lines);

$smtpSend = static function (array $c, string $from, string $fromDisplay, string $to, string $replyTo, string $replyName, string $subj, string $msgBody): bool {
    $host = (string)($c['smtp_host'] ?? '');
    $port = (int)($c['smtp_port'] ?? 465);
    $user = (string)($c['smtp_user'] ?? '');
    $pass = (string)($c['smtp_pass'] ?? '');
    if ($host === '' || $user === '' || $pass === '') {
        return false;
    }
    $transport = ($port === 465 ? 'ssl://' : 'tcp://') . $host . ':' . $port;
    $sock = @stream_socket_client($transport, $errno, $errstr, 12, STREAM_CLIENT_CONNECT);
    if ($sock === false) {
        return false;
    }
    stream_set_timeout($sock, 12);
    $readResp = static function ($s): int {
        $code = 0;
        while (($line = fgets($s, 515)) !== false) {
            $code = (int)substr($line, 0, 3);
            if (!isset($line[3]) || $line[3] !== '-') {
                break;
            }
        }
        return $code;
    };
    $cmd = static function ($s, string $command, array $okCodes) use ($readResp): bool {
        fwrite($s, $command . "\r\n");
        return in_array($readResp($s), $okCodes, true);
    };
    if ($readResp($sock) !== 220) {
        fclose($sock);
        return false;
    }
    $ehloHost = !empty($_SERVER['SERVER_NAME']) ? (string)$_SERVER['SERVER_NAME'] : 'agrecir.com';
    if (!$cmd($sock, 'EHLO ' . $ehloHost, [250])) {
        fclose($sock);
        return false;
    }
    if ($port === 587) {
        if (!$cmd($sock, 'STARTTLS', [220]) || !stream_socket_enable_crypto($sock, true, STREAM_CRYPTO_METHOD_TLS_CLIENT) || !$cmd($sock, 'EHLO ' . $ehloHost, [250])) {
            fclose($sock);
            return false;
        }
    }
    if (
        !$cmd($sock, 'AUTH LOGIN', [334])
        || !$cmd($sock, base64_encode($user), [334])
        || !$cmd($sock, base64_encode($pass), [235])
        || !$cmd($sock, 'MAIL FROM:<' . $from . '>', [250])
        || !$cmd($sock, 'RCPT TO:<' . $to . '>', [250, 251])
        || !$cmd($sock, 'DATA', [354])
    ) {
        fclose($sock);
        return false;
    }
    $safeBody = preg_replace('/^\./m', '..', $msgBody) ?? $msgBody;
    $hdrs = [
        'Date: ' . gmdate('r'),
        'From: =?UTF-8?B?' . base64_encode($fromDisplay) . '?= <' . $from . '>',
        'To: <' . $to . '>',
        'Reply-To: =?UTF-8?B?' . base64_encode($replyName) . '?= <' . $replyTo . '>',
        'Subject: ' . $subj,
        'Message-ID: <' . bin2hex(random_bytes(12)) . '@agrecir.com>',
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: 8bit',
    ];
    $ok = $cmd($sock, implode("\r\n", $hdrs) . "\r\n\r\n" . $safeBody . "\r\n.", [250]);
    $cmd($sock, 'QUIT', [221]);
    fclose($sock);
    return $ok;
};

$sent = false;
if (!empty($cfg['smtp_host'])) {
    $sent = $smtpSend($cfg, $fromEmail, $fromName, $toEmail, $email, $name, $encodedSubject, $body);
}

if (!$sent) {
    $headers = [
        'From: =?UTF-8?B?' . base64_encode($fromName) . '?= <' . $fromEmail . '>',
        'Reply-To: =?UTF-8?B?' . base64_encode($name) . '?= <' . $email . '>',
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: 8bit',
        'X-Mailer: AgReCir-Web/1.0',
    ];
    $headerStr = implode("\r\n", $headers);
    $sent = @mail($toEmail, $encodedSubject, $body, $headerStr, '-f ' . $fromEmail);
    if (!$sent) {
        $sent = @mail($toEmail, $encodedSubject, $body, $headerStr);
    }
}

if (!$sent) {
    $respond(500, [
        'ok' => false,
        'error' => 'Something went wrong on our side. Please try again, or email info@agrecir.com.',
    ], '/contact/?error=1#contact-form');
}

$respond(200, [
    'ok' => true,
    'message' => "Thank you. Your message has reached the AgReCir team, and we'll reply as soon as we can. If it's urgent, call or WhatsApp +92 345 4867555.",
], '/contact/?sent=1#contact-form');
