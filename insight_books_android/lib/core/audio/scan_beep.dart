import 'dart:math' as math;
import 'dart:typed_data';

import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

/// Short confirmation beep (scanner item found).
Future<void> playScanConfirmBeep() async {
  await _playTone(frequencyHz: 920, durationSec: 0.14);
}

/// Lower tone when barcode did not match a product.
Future<void> playScanErrorTone() async {
  await _playTone(frequencyHz: 360, durationSec: 0.2);
}

Future<void> _playTone({
  required double frequencyHz,
  required double durationSec,
}) async {
  if (kIsWeb) {
    await SystemSound.play(SystemSoundType.click);
    return;
  }
  final wav = _buildToneWav(
    frequencyHz: frequencyHz,
    durationSec: durationSec,
  );
  final player = AudioPlayer();
  try {
    await player.setAudioContext(
      AudioContext(
        android: AudioContextAndroid(
          usageType: AndroidUsageType.assistanceSonification,
          contentType: AndroidContentType.sonification,
          audioMode: AndroidAudioMode.normal,
        ),
      ),
    );
    await player.setReleaseMode(ReleaseMode.stop);
    await player.play(BytesSource(wav, mimeType: 'audio/wav'));
    // Let PCM finish; BytesSource has no reliable onComplete on all devices.
    await Future<void>.delayed(
      Duration(milliseconds: (durationSec * 1000).round() + 80),
    );
  } catch (_) {
    await SystemSound.play(SystemSoundType.click);
  } finally {
    await player.dispose();
  }
}

Uint8List _buildToneWav({
  required double frequencyHz,
  required double durationSec,
  int sampleRate = 44100,
}) {
  final n = (sampleRate * durationSec).round();
  final pcm = Int16List(n);
  for (var i = 0; i < n; i++) {
    final t = i / sampleRate;
    final env = i < n * 0.12
        ? (i / (n * 0.12))
        : (1.0 - (i - n * 0.12) / (n * 0.88)).clamp(0.0, 1.0);
    final s = 0.42 * env * math.sin(2 * math.pi * frequencyHz * t);
    pcm[i] = (s * 32767).round().clamp(-32768, 32767);
  }
  return _pcm16MonoWavBytes(pcm, sampleRate);
}

Uint8List _pcm16MonoWavBytes(Int16List pcm, int sampleRate) {
  final dataSize = pcm.length * 2;
  final chunkSize = 36 + dataSize;
  final b = BytesBuilder();
  b.add('RIFF'.codeUnits);
  _addLe32(b, chunkSize);
  b.add('WAVE'.codeUnits);
  b.add('fmt '.codeUnits);
  _addLe32(b, 16);
  _addLe16(b, 1);
  _addLe16(b, 1);
  _addLe32(b, sampleRate);
  _addLe32(b, sampleRate * 2);
  _addLe16(b, 2);
  _addLe16(b, 16);
  b.add('data'.codeUnits);
  _addLe32(b, dataSize);
  for (var i = 0; i < pcm.length; i++) {
    final v = pcm[i];
    b.add([v & 0xff, (v >> 8) & 0xff]);
  }
  return Uint8List.fromList(b.toBytes());
}

void _addLe32(BytesBuilder b, int v) {
  b.add([v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >> 24) & 0xff]);
}

void _addLe16(BytesBuilder b, int v) {
  b.add([v & 0xff, (v >> 8) & 0xff]);
}
