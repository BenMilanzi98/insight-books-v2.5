<?php
declare(strict_types=1);

namespace App\Helpers;

class Security
{
    private static array $config = [];

    public static function init(array $config): void
    {
        self::$config = $config;
    }

    public static function escape(?string $value): string
    {
        return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }

    public static function canonicalJson(array $payload): string
    {
        ksort($payload);
        return json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    }

    public static function signPayload(array $payload, ?string $secret = null): string
    {
        $secret = $secret ?? (self::$config['api_shared_secret'] ?? '');
        return hash_hmac('sha256', self::canonicalJson($payload), $secret);
    }

    public static function verifySignature(array $payload, string $signature, ?string $secret = null): bool
    {
        $expected = self::signPayload($payload, $secret);
        return hash_equals($expected, $signature);
    }

    public static function validateApiKey(?string $key): bool
    {
        $expected = self::$config['api_key'] ?? '';
        return $expected !== '' && $key !== null && hash_equals($expected, $key);
    }

    public static function clientIp(): string
    {
        $ip = $_SERVER['REMOTE_ADDR'] ?? '';
        if (filter_var($ip, FILTER_VALIDATE_IP)) {
            return $ip;
        }
        return '0.0.0.0';
    }

    public static function randomFilename(string $ext): string
    {
        return bin2hex(random_bytes(16)) . '.' . ltrim($ext, '.');
    }
}
