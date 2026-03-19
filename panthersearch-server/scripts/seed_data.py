from __future__ import annotations

import json
import re
from pathlib import Path

SEMESTERS = ['Fall 2025', 'Summer 2025', 'Spring 2025', 'Fall 2024', 'Summer 2024', 'Spring 2024', 'Fall 2023', 'Summer 2023', 'Spring 2023']
GRADE_KEYS = ['4.0', '3.5', '3.0', '2.5', '2.0', '1.5', '1.0', '0.0', 'I', 'CR', 'NC']

ROOT = Path(__file__).resolve().parents[1]
CLIENT = ROOT.parent / 'panthersearch-client' / 'src' / 'data'
OUT = ROOT / 'app' / 'data'


def slugify_class_code(code: str) -> str:
    return code.replace(' ', '')


def empty_distribution() -> dict[str, int]:
    return {key: 0 for key in GRADE_KEYS}


def sum_distributions(items: list[dict[str, int]]) -> dict[str, int]:
    total = empty_distribution()
    for item in items:
        for key in GRADE_KEYS:
            total[key] += int(item.get(key, 0))
    return total


def get_median_key(distribution: dict[str, int]) -> str:
    total = sum(distribution.values())
    if total == 0:
        return '4.0'
    running = 0
    for key in GRADE_KEYS:
        running += distribution[key]
        if running >= total / 2:
            return key
    return 'NC'


def grade_weights_from_gpa(avg_gpa: float) -> dict[str, float]:
    gpa_factor = (avg_gpa - 2.2) / 1.8
    weights = {
        '4.0': 0.16 + gpa_factor * 0.2,
        '3.5': 0.14 + gpa_factor * 0.12,
        '3.0': 0.16 + gpa_factor * 0.05,
        '2.5': 0.12 - gpa_factor * 0.02,
        '2.0': 0.11 - gpa_factor * 0.06,
        '1.5': 0.08 - gpa_factor * 0.05,
        '1.0': 0.07 - gpa_factor * 0.04,
        '0.0': 0.08 - gpa_factor * 0.08,
        'I': 0.03,
        'CR': 0.03,
        'NC': 0.02,
    }
    total = sum(max(0.01, value) for value in weights.values())
    return {key: max(0.01, value) / total for key, value in weights.items()}


def build_distribution(avg_gpa: float, students: int, offset: int) -> dict[str, int]:
    weights = grade_weights_from_gpa(avg_gpa)
    distribution = empty_distribution()
    allocated = 0
    for index, key in enumerate(GRADE_KEYS):
        modifier = 1 + (((offset + index) % 5) - 2) * 0.015
        if index == len(GRADE_KEYS) - 1:
            value = students - allocated
        else:
            value = max(0, round(students * weights[key] * modifier))
        distribution[key] = value
        allocated += value
    if allocated != students:
        distribution['3.0'] += students - allocated
    return distribution


def build_semester_breakdown(seed: dict, seed_index: int) -> list[dict]:
    rows = []
    for semester_index, semester in enumerate(SEMESTERS):
        students = max(28, seed['baseStudents'] + ((seed_index + 3) % 7) * 5 - semester_index * 3 + (6 if semester_index % 2 == 0 else -4))
        avg_gpa = round(min(3.95, max(2.2, seed['avgGPA'] + (((seed_index + semester_index) % 5) - 2) * 0.06)), 2)
        rows.append({
            'semester': semester,
            'students': students,
            'avgGPA': avg_gpa,
            'gradeDistribution': build_distribution(avg_gpa, students, seed_index + semester_index),
        })
    return rows


def parse_class_seed() -> list[dict]:
    content = (CLIENT / 'classes.ts').read_text(encoding='utf-8')
    pattern = re.compile(
        r"\{ code: '([^']+)', name: '([^']+)', department: '([^']+)', credits: (\d+), description: '([^']+)', instructorIds: \[(.*?)\], tags: \[(.*?)\], baseStudents: (\d+), avgGPA: ([\d.]+), viewCount: (\d+) \}",
        re.MULTILINE,
    )
    records = []
    for match in pattern.finditer(content):
        instructor_ids = re.findall(r"'([^']+)'", match.group(6))
        tags = re.findall(r"'([^']+)'", match.group(7))
        seed = {
            'code': match.group(1),
            'slug': slugify_class_code(match.group(1)),
            'name': match.group(2),
            'department': match.group(3),
            'credits': int(match.group(4)),
            'description': match.group(5),
            'instructorIds': instructor_ids,
            'tags': tags,
            'baseStudents': int(match.group(8)),
            'avgGPA': float(match.group(9)),
            'viewCount': int(match.group(10)),
        }
        records.append(seed)
    return records


def parse_instructors() -> list[dict]:
    content = (CLIENT / 'instructors.ts').read_text(encoding='utf-8')
    pattern = re.compile(
        r"\{ id: '([^']+)', name: '([^']+)', department: '([^']+)', title: '([^']+)', rating: ([\d.]+), difficulty: ([\d.]+), wouldTakeAgain: (\d+), classIds: \[(.*?)\], tags: \[(.*?)\], bio: '([^']+)', viewCount: (\d+) \}",
        re.MULTILINE,
    )
    rows = []
    for index, match in enumerate(pattern.finditer(content)):
        class_ids = re.findall(r"'([^']+)'", match.group(8))
        tags = re.findall(r"'([^']+)'", match.group(9))
        rows.append({
            'id': match.group(1),
            'name': match.group(2),
            'department': match.group(3),
            'title': match.group(4),
            'rating': float(match.group(5)),
            'difficulty': float(match.group(6)),
            'wouldTakeAgain': int(match.group(7)),
            'classIds': class_ids,
            'tags': tags,
            'bio': match.group(10),
            'viewCount': int(match.group(11)),
            'semestersTaught': SEMESTERS[: 5 + (index % 4)],
        })
    return rows


def build_grades(class_seeds: list[dict]) -> dict[str, dict]:
    payload: dict[str, dict] = {}
    for index, seed in enumerate(class_seeds):
        semester_breakdown = build_semester_breakdown(seed, index)
        overall_distribution = sum_distributions([item['gradeDistribution'] for item in semester_breakdown])
        payload[seed['code']] = {
            'courseCode': seed['code'],
            'courseName': seed['name'],
            'cachedAt': 'seeded',
            'source': 'local-seed',
            'summary': {
                'avgGPA': round(sum(item['avgGPA'] for item in semester_breakdown) / len(semester_breakdown), 2),
                'medianGrade': get_median_key(overall_distribution),
                'totalStudents': sum(item['students'] for item in semester_breakdown),
            },
            'semesters': [
                {
                    'term': item['semester'],
                    'instructor': 'Multiple Instructors',
                    'gradeDistribution': {
                        'A': item['gradeDistribution']['4.0'],
                        'B': item['gradeDistribution']['3.0'],
                        'C': item['gradeDistribution']['2.0'],
                        'D': item['gradeDistribution']['1.0'],
                        'F': item['gradeDistribution']['0.0'],
                        'W': item['gradeDistribution']['I'],
                        'WF': item['gradeDistribution']['NC'],
                    },
                    'totalStudents': item['students'],
                    'avgGPA': item['avgGPA'],
                }
                for item in semester_breakdown
            ],
        }
    return payload


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    class_seeds = parse_class_seed()
    instructor_seeds = parse_instructors()
    (OUT / 'catalog_seed.json').write_text(json.dumps(class_seeds, indent=2), encoding='utf-8')
    (OUT / 'instructor_seed.json').write_text(json.dumps(instructor_seeds, indent=2), encoding='utf-8')
    (OUT / 'grades.json').write_text(json.dumps(build_grades(class_seeds), indent=2), encoding='utf-8')
    views = {
        'class': [
            {'type': 'class', 'key': item['code'], 'label': f"{item['code']}: {item['name']}", 'href': f"/class/{item['slug']}", 'subtitle': item['department'], 'count': item['viewCount']}
            for item in sorted(class_seeds, key=lambda row: row['viewCount'], reverse=True)[:25]
        ],
        'instructor': [
            {'type': 'instructor', 'key': item['id'], 'label': item['name'], 'href': f"/instructor/{item['id']}", 'subtitle': item['department'], 'count': item['viewCount']}
            for item in sorted(instructor_seeds, key=lambda row: row['viewCount'], reverse=True)[:25]
        ],
    }
    (OUT / 'views.json').write_text(json.dumps(views, indent=2), encoding='utf-8')
    print(f'Seeded {len(class_seeds)} classes and {len(instructor_seeds)} instructors')


if __name__ == '__main__':
    main()
