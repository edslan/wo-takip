
class ToDoNote {
  final String id;
  final String text;
  final String author;
  final DateTime date;

  ToDoNote({
    required this.id,
    required this.text,
    required this.author,
    required this.date,
  });

  factory ToDoNote.fromMap(Map<String, dynamic> map) {
    return ToDoNote(
      id: map['id'] ?? '',
      text: map['text'] ?? '',
      author: map['author'] ?? '',
      date: DateTime.fromMillisecondsSinceEpoch(map['date'] ?? 0),
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'text': text,
      'author': author,
      'date': date.millisecondsSinceEpoch,
    };
  }
}

class ToDoItem {
  final String id;
  final String title;
  final String priority; // 'Yüksek' | 'Orta' | 'Düşük'
  final String comments;
  final String status; // 'Bekliyor' | 'Devam Ediyor' | 'Tamamlandı'
  final DateTime createdAt;
  final DateTime? dueDate;
  final String createdBy;
  final String? assignedTo;
  final List<ToDoNote> notes;
  final bool isPinned;

  ToDoItem({
    required this.id,
    required this.title,
    required this.priority,
    required this.comments,
    required this.status,
    required this.createdAt,
    this.dueDate,
    required this.createdBy,
    this.assignedTo,
    this.notes = const [],
    this.isPinned = false,
  });

  factory ToDoItem.fromMap(Map<String, dynamic> map) {
    return ToDoItem(
      id: map['id'] ?? '',
      title: map['title'] ?? '',
      priority: map['priority'] ?? 'Orta',
      comments: map['comments'] ?? '',
      status: map['status'] ?? 'Bekliyor',
      createdAt: DateTime.fromMillisecondsSinceEpoch(map['createdAt'] ?? 0),
      dueDate: map['dueDate'] != null ? DateTime.tryParse(map['dueDate']) : null,
      createdBy: map['createdBy'] ?? '',
      assignedTo: map['assignedTo'],
      notes: map['notes'] != null 
          ? List<ToDoNote>.from(map['notes']?.map((x) => ToDoNote.fromMap(x)))
          : [],
      isPinned: map['pinned'] ?? false,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'title': title,
      'priority': priority,
      'comments': comments,
      'status': status,
      'createdAt': createdAt.millisecondsSinceEpoch,
      'dueDate': dueDate?.toIso8601String(),
      'createdBy': createdBy,
      'assignedTo': assignedTo,
      'notes': notes.map((x) => x.toMap()).toList(),
      'pinned': isPinned,
    };
  }
}
