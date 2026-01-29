
class ShiftReport {
  final String id;
  final String rawText;
  final String dateStr; // YYYY-MM-DD
  final String shiftName;
  final List<String> personnel;
  final List<String> completedJobs;
  final List<String> issues;
  final List<String> pending;
  final String aiSummary;
  final DateTime createdAt;
  final String createdBy;

  ShiftReport({
    required this.id,
    required this.rawText,
    required this.dateStr,
    required this.shiftName,
    required this.personnel,
    required this.completedJobs,
    required this.issues,
    required this.pending,
    required this.aiSummary,
    required this.createdAt,
    required this.createdBy,
  });

  factory ShiftReport.fromMap(Map<String, dynamic> map) {
    return ShiftReport(
      id: map['id'] ?? '',
      rawText: map['rawText'] ?? '',
      dateStr: map['dateStr'] ?? '',
      shiftName: map['shiftName'] ?? '',
      personnel: List<String>.from(map['personnel'] ?? []),
      completedJobs: List<String>.from(map['completedJobs'] ?? []),
      issues: List<String>.from(map['issues'] ?? []),
      pending: List<String>.from(map['pending'] ?? []),
      aiSummary: map['aiSummary'] ?? '',
      createdAt: DateTime.fromMillisecondsSinceEpoch(map['createdAt'] ?? 0),
      createdBy: map['createdBy'] ?? '',
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'rawText': rawText,
      'dateStr': dateStr,
      'shiftName': shiftName,
      'personnel': personnel,
      'completedJobs': completedJobs,
      'issues': issues,
      'pending': pending,
      'aiSummary': aiSummary,
      'createdAt': createdAt.millisecondsSinceEpoch,
      'createdBy': createdBy,
    };
  }
}
