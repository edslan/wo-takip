
class WorkOrder {
  final String code;
  final String name;
  final String? assetName;
  final String? activityType;
  final String statusCode;
  final DateTime? startDate;
  final DateTime? endDate;
  final String? comments;
  final String priority;
  final bool isAssetOutOfOrder;
  final String? closeReason;

  WorkOrder({
    required this.code,
    required this.name,
    this.assetName,
    this.activityType,
    required this.statusCode,
    this.startDate,
    this.endDate,
    this.comments,
    this.priority = 'Normal',
    this.isAssetOutOfOrder = false,
    this.closeReason,
  });

  // Excel veya Firebase'den gelen ham veriyi (Map) Dart objesine çevirir
  factory WorkOrder.fromMap(Map<String, dynamic> map) {
    // Tarih dönüşümü için yardımcı mantık
    DateTime? parseDate(dynamic val) {
      if (val == null) return null;
      if (val is int) return DateTime.fromMillisecondsSinceEpoch(val);
      if (val is String) return DateTime.tryParse(val);
      return null;
    }

    return WorkOrder(
      code: map['Work order code']?.toString() ?? '',
      name: map['Work order name']?.toString() ?? 'Tanımsız İş',
      assetName: map['Asset Name']?.toString(),
      activityType: map['WO Activity type Activity type code']?.toString(),
      statusCode: map['Status code']?.toString() ?? 'Open',
      startDate: parseDate(map['Work order start date/time']),
      endDate: parseDate(map['Work order end date/time']),
      comments: map['Comments: Name without formatting']?.toString(),
      priority: map['Priority']?.toString() ?? 'Normal',
      // Excel'den "Doğru", "True" veya "1" gelebilir, bunu kontrol ediyoruz
      isAssetOutOfOrder: map['Asset out of order?'].toString().toLowerCase().contains('true') || 
                         map['Asset out of order?'].toString().toLowerCase().contains('doğru') ||
                         map['Asset out of order?'] == '1',
      closeReason: map['closeReason']?.toString(),
    );
  }

  // Objeyi tekrar Firebase'e kaydetmek için Map formatına çevirir
  Map<String, dynamic> toMap() {
    return {
      'Work order code': code,
      'Work order name': name,
      'Asset Name': assetName,
      'WO Activity type Activity type code': activityType,
      'Status code': statusCode,
      'Work order start date/time': startDate?.millisecondsSinceEpoch,
      'Work order end date/time': endDate?.millisecondsSinceEpoch,
      'Comments: Name without formatting': comments,
      'Priority': priority,
      'Asset out of order?': isAssetOutOfOrder.toString(),
      'closeReason': closeReason,
    };
  }
}
