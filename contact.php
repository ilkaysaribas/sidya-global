<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

$defaultConfig = [
    'to' => 'info@sidyaglobal.com',
    'from' => 'info@sidyaglobal.com',
    'from_name' => 'Sidya Global',
    'smtp' => [
        'enabled' => false,
        'host' => '',
        'port' => 587,
        'secure' => 'tls',
        'username' => '',
        'password' => '',
    ],
];

$configFile = __DIR__ . '/mail-config.php';
$config = $defaultConfig;
if (is_file($configFile)) {
    $loadedConfig = require $configFile;
    if (is_array($loadedConfig)) {
        $config = array_replace_recursive($config, $loadedConfig);
    }
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(405, ['ok' => false, 'message' => 'Method not allowed']);
}

$fields = [
    'name' => cleanText((string)($_POST['name'] ?? ''), 120),
    'company' => cleanText((string)($_POST['company'] ?? ''), 160),
    'email' => cleanText((string)($_POST['email'] ?? ''), 180),
    'product' => cleanText((string)($_POST['product'] ?? ''), 120),
    'message' => cleanText((string)($_POST['message'] ?? ''), 3000),
];

if (
    $fields['name'] === '' ||
    $fields['company'] === '' ||
    $fields['product'] === '' ||
    $fields['message'] === '' ||
    !filter_var($fields['email'], FILTER_VALIDATE_EMAIL)
) {
    respond(422, ['ok' => false, 'message' => 'Invalid form data']);
}

$subject = cleanHeader('Website export inquiry - ' . $fields['product']);
$body = implode("\n", [
    'Name: ' . $fields['name'],
    'Company: ' . $fields['company'],
    'Email: ' . $fields['email'],
    'Product: ' . $fields['product'],
    'IP: ' . ($_SERVER['REMOTE_ADDR'] ?? 'unknown'),
    '',
    'Message:',
    $fields['message'],
]);

$message = [
    'to' => cleanHeader((string)$config['to']),
    'from' => cleanHeader((string)$config['from']),
    'from_name' => cleanHeader((string)$config['from_name']),
    'reply_to' => cleanHeader($fields['email']),
    'subject' => $subject,
    'body' => $body,
];

$sent = !empty($config['smtp']['enabled'])
    ? sendWithSmtp($config, $message)
    : sendWithPhpMail($message);

if (!$sent) {
    respond(500, ['ok' => false, 'message' => 'Mail could not be sent']);
}

respond(200, ['ok' => true]);

function respond(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload);
    exit;
}

function cleanText(string $value, int $maxLength): string
{
    $value = trim(str_replace("\0", '', $value));
    if (function_exists('mb_substr')) {
        return mb_substr($value, 0, $maxLength, 'UTF-8');
    }

    return substr($value, 0, $maxLength);
}

function cleanHeader(string $value): string
{
    return trim(str_replace(["\r", "\n"], '', $value));
}

function sendWithPhpMail(array $message): bool
{
    $headers = [
        'From: ' . formatAddress($message['from'], $message['from_name']),
        'Reply-To: ' . $message['reply_to'],
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: 8bit',
        'X-Mailer: PHP/' . phpversion(),
    ];

    $extraParams = PHP_OS_FAMILY === 'Windows' ? '' : '-f' . $message['from'];

    return mail(
        $message['to'],
        $message['subject'],
        $message['body'],
        implode("\r\n", $headers),
        $extraParams
    );
}

function sendWithSmtp(array $config, array $message): bool
{
    $smtp = $config['smtp'];
    $host = (string)$smtp['host'];
    $port = (int)$smtp['port'];
    $secure = strtolower((string)$smtp['secure']);
    $username = (string)$smtp['username'];
    $password = (string)$smtp['password'];

    if ($host === '' || $port <= 0) {
        return false;
    }

    $transport = $secure === 'ssl' ? 'ssl' : 'tcp';
    $socket = @stream_socket_client(
        $transport . '://' . $host . ':' . $port,
        $errno,
        $errstr,
        20,
        STREAM_CLIENT_CONNECT
    );

    if (!$socket) {
        return false;
    }

    stream_set_timeout($socket, 20);

    try {
        smtpExpect($socket, [220]);
        smtpCommand($socket, 'EHLO sidyaglobal.com', [250]);

        if ($secure === 'tls') {
            smtpCommand($socket, 'STARTTLS', [220]);
            if (!stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                fclose($socket);
                return false;
            }
            smtpCommand($socket, 'EHLO sidyaglobal.com', [250]);
        }

        if ($username !== '' || $password !== '') {
            smtpCommand($socket, 'AUTH LOGIN', [334]);
            smtpCommand($socket, base64_encode($username), [334]);
            smtpCommand($socket, base64_encode($password), [235]);
        }

        smtpCommand($socket, 'MAIL FROM:<' . $message['from'] . '>', [250]);
        smtpCommand($socket, 'RCPT TO:<' . $message['to'] . '>', [250, 251]);
        smtpCommand($socket, 'DATA', [354]);

        $headers = [
            'Date: ' . date('r'),
            'To: ' . $message['to'],
            'From: ' . formatAddress($message['from'], $message['from_name']),
            'Reply-To: ' . $message['reply_to'],
            'Subject: ' . $message['subject'],
            'MIME-Version: 1.0',
            'Content-Type: text/plain; charset=UTF-8',
            'Content-Transfer-Encoding: 8bit',
        ];

        fwrite($socket, dotStuff(implode("\r\n", $headers) . "\r\n\r\n" . $message['body']) . "\r\n.\r\n");
        smtpExpect($socket, [250]);
        smtpCommand($socket, 'QUIT', [221]);
        fclose($socket);
        return true;
    } catch (RuntimeException $exception) {
        fclose($socket);
        return false;
    }
}

function smtpCommand($socket, string $command, array $expectedCodes): string
{
    fwrite($socket, $command . "\r\n");
    return smtpExpect($socket, $expectedCodes);
}

function smtpExpect($socket, array $expectedCodes): string
{
    $response = '';
    while (($line = fgets($socket, 515)) !== false) {
        $response .= $line;
        if (preg_match('/^(\d{3})\s/', $line, $matches)) {
            $code = (int)$matches[1];
            if (!in_array($code, $expectedCodes, true)) {
                throw new RuntimeException('Unexpected SMTP response: ' . $response);
            }
            return $response;
        }
    }

    throw new RuntimeException('No SMTP response received');
}

function formatAddress(string $email, string $name): string
{
    if ($name === '') {
        return $email;
    }

    return '"' . addcslashes($name, '"\\') . '" <' . $email . '>';
}

function dotStuff(string $data): string
{
    $data = str_replace(["\r\n", "\r"], "\n", $data);
    $data = (string)preg_replace('/^\./m', '..', $data);

    return str_replace("\n", "\r\n", $data);
}
