<?php
declare(strict_types=1);

namespace App\Helpers;

class Validator
{
    public static function required(string $value, string $field): ?string
    {
        return trim($value) === '' ? "{$field} is required." : null;
    }

    public static function email(?string $value): ?string
    {
        if ($value === null || trim($value) === '') {
            return null;
        }
        return filter_var($value, FILTER_VALIDATE_EMAIL) ? null : 'Invalid email address.';
    }

    public static function versionCode($value): ?string
    {
        if (!is_numeric($value) || (int) $value < 1) {
            return 'Version code must be a positive integer.';
        }
        return null;
    }

    public static function rating($value): ?string
    {
        $r = (int) $value;
        if ($r < 1 || $r > 5) {
            return 'Rating must be between 1 and 5.';
        }
        return null;
    }

    public static function apkFile(array $file, int $maxMb): ?string
    {
        if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            return 'APK upload failed.';
        }
        if (($file['size'] ?? 0) > $maxMb * 1024 * 1024) {
            return "APK must be under {$maxMb}MB.";
        }
        $ext = strtolower(pathinfo((string) $file['name'], PATHINFO_EXTENSION));
        if ($ext !== 'apk') {
            return 'Only .apk files are allowed.';
        }
        $mime = mime_content_type($file['tmp_name']) ?: '';
        $allowed = ['application/vnd.android.package-archive', 'application/octet-stream', 'application/zip'];
        if ($mime && !in_array($mime, $allowed, true)) {
            return 'Invalid APK file type.';
        }
        $fh = fopen($file['tmp_name'], 'rb');
        if ($fh) {
            $head = fread($fh, 4);
            fclose($fh);
            if ($head !== "PK\x03\x04") {
                return 'File does not appear to be a valid APK (ZIP archive).';
            }
        }
        if (class_exists(\ZipArchive::class)) {
            $zip = new \ZipArchive();
            if ($zip->open($file['tmp_name']) !== true) {
                return 'APK archive could not be opened.';
            }
            $hasManifest = $zip->locateName('AndroidManifest.xml') !== false;
            $zip->close();
            if (!$hasManifest) {
                return 'APK is missing AndroidManifest.xml.';
            }
        }
        return null;
    }
}
