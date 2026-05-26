<?php
declare(strict_types=1);

namespace App\Helpers;

class Upload
{
    public static function ensureDir(string $path): void
    {
        if (!is_dir($path)) {
            mkdir($path, 0755, true);
        }
    }

    public static function moveApk(array $file, string $destDir): array
    {
        self::ensureDir($destDir);
        $filename = Security::randomFilename('apk');
        $dest = rtrim($destDir, '/\\') . DIRECTORY_SEPARATOR . $filename;
        if (!move_uploaded_file($file['tmp_name'], $dest)) {
            throw new \RuntimeException('Failed to store APK file.');
        }
        return [
            'stored_name' => $filename,
            'path' => $dest,
            'size' => filesize($dest) ?: 0,
        ];
    }

    public static function moveImage(array $file, string $destDir, int $maxMb): array
    {
        self::ensureDir($destDir);
        $ext = strtolower(pathinfo((string) $file['name'], PATHINFO_EXTENSION));
        if (!in_array($ext, ['jpg', 'jpeg', 'png', 'webp'], true)) {
            throw new \RuntimeException('Invalid image type.');
        }
        if (($file['size'] ?? 0) > $maxMb * 1024 * 1024) {
            throw new \RuntimeException('Image too large.');
        }
        $mime = mime_content_type($file['tmp_name']) ?: '';
        $allowedMimes = [
            'jpg' => ['image/jpeg'],
            'jpeg' => ['image/jpeg'],
            'png' => ['image/png'],
            'webp' => ['image/webp'],
        ];
        if (!in_array($mime, $allowedMimes[$ext] ?? [], true)) {
            throw new \RuntimeException('Invalid image MIME type.');
        }
        if (@getimagesize($file['tmp_name']) === false) {
            throw new \RuntimeException('Uploaded file is not a valid image.');
        }
        $filename = Security::randomFilename($ext);
        $dest = rtrim($destDir, '/\\') . DIRECTORY_SEPARATOR . $filename;
        if (!move_uploaded_file($file['tmp_name'], $dest)) {
            throw new \RuntimeException('Failed to store image.');
        }
        return ['stored_name' => $filename, 'path' => $dest];
    }
}
