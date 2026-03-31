import 'dart:typed_data';

/// True if [data] starts with the PDF magic bytes "%PDF".
bool bytesLookLikePdf(List<int> data) {
  if (data.length < 4) return false;
  return data[0] == 0x25 &&
      data[1] == 0x50 &&
      data[2] == 0x44 &&
      data[3] == 0x46;
}

/// Normalizes Dio [responseType: bytes] payloads to a [List<int>].
List<int> bytesFromDioResponse(dynamic data, {required String label}) {
  if (data == null) {
    throw Exception('Empty $label response from server.');
  }
  if (data is Uint8List) return data;
  if (data is List<int>) return data;
  throw Exception('Unexpected response type for $label.');
}

/// Ensures [data] is a PDF (magic bytes) or throws with a clear message if JSON/HTML/other.
void ensurePdfResponseBytes(List<int> data, {required String label}) {
  if (data.isEmpty) {
    throw Exception('Empty $label response from server.');
  }
  if (bytesLookLikePdf(data)) return;
  final head = String.fromCharCodes(data.take(200));
  final trimmed = head.trimLeft();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    throw Exception('$label could not be downloaded (server returned JSON).');
  }
  if (trimmed.startsWith('<!') || trimmed.startsWith('<html')) {
    throw Exception(
      '$label was returned as HTML instead of PDF. Check the server PDF endpoint.',
    );
  }
  throw Exception('$label was not returned as a valid PDF.');
}

/// Use after a PDF GET: validates and returns bytes for saving/sharing.
List<int> requirePdfBytesFromResponse(dynamic data, {required String label}) {
  final bytes = bytesFromDioResponse(data, label: label);
  ensurePdfResponseBytes(bytes, label: label);
  return bytes;
}
