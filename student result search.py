"""
Student Result Search System: Comparing Linear Search vs Binary Search
Performance on Sorted Roll Numbers.
Author: College Project Model
Run: python student_result_search.py
Optional graphs: pip install matplotlib
"""
from dataclasses import dataclass
from random import Random
from time import perf_counter
import csv
import sys

SUBJECTS = ("Python", "Data Structures", "Mathematics", "Electronics", "Communication Skills")
SIZES = (100, 1000, 10000, 100000)
FIRST_ROLL = 1001
FIRST_NAMES = [
    "Aarav", "Aditi", "Arjun", "Anaya", "Ishaan", "Isha", "Kabir", "Kavya",
    "Rohan", "Saanvi", "Vivaan", "Diya", "Aditya", "Meera", "Yash", "Tanvi"
]
LAST_NAMES = [
    "Patil", "Sharma", "Jadhav", "Deshmukh", "Kulkarni", "Pawar", "Joshi",
    "More", "Shinde", "Chavan", "Kadam", "Gupta"
]

@dataclass
class Student:
    """One student record with marks and calculated result fields."""
    roll_no: int
    name: str
    marks: list
    total: int
    percentage: float
    grade: str
    status: str

def grade_for(percentage: float) -> str:
    """Calculate letter grade based on percentage."""
    if percentage >= 90: return "A+"
    if percentage >= 80: return "A"
    if percentage >= 70: return "B"
    if percentage >= 60: return "C"
    if percentage >= 50: return "D"
    return "E"

def generate_data(size: int, seed: int = None) -> list:
    """Create fictional student records with unique, ascending roll numbers."""
    rng = Random(seed) if seed is not None else Random()
    result = []
    for offset in range(size):
        marks = [rng.randint(25, 100) for _ in SUBJECTS]
        total = sum(marks)
        percentage = round(total / len(SUBJECTS), 2)
        status = "Pass" if all(mark >= 35 for mark in marks) else "Fail"
        name = f"{rng.choice(FIRST_NAMES)} {rng.choice(LAST_NAMES)}"
        result.append(Student(FIRST_ROLL + offset, name, marks, total,
                              percentage, grade_for(percentage), status))
    # Roll numbers are sorted by construction, which Binary Search requires.
    return result

def linear_search(arr: list, key: int):
    """
    Scan array sequentially from left to right.
    Returns: (index, comparisons)
    Time Complexity: Best O(1), Average O(n), Worst O(n)
    """
    comparisons = 0
    for i, student in enumerate(arr):
        comparisons += 1
        if student.roll_no == key:
            return i, comparisons
    return -1, comparisons

def binary_search(arr: list, key: int, trace: bool = False):
    """
    Iterative binary search on sorted array; return (index, comparisons).
    Input must be sorted by roll_no to halve the search space at each step.
    Time Complexity: Best O(1), Average O(log n), Worst O(log n)
    """
    low, high, comparisons, step = 0, len(arr) - 1, 0, 0
    if trace:
        print(f"\n{'=' * 65}")
        print(f" BINARY SEARCH STEP-BY-STEP TRACE (Target Roll: {key})")
        print(f"{'=' * 65}")
    while low <= high:
        step += 1
        mid = (low + high) // 2
        comparisons += 1
        value = arr[mid].roll_no
        if trace:
            print(f"Step {step:2d} | Range: [{low:5d} .. {high:5d}] | Mid Index: {mid:5d} | Roll: {value}")
        if value == key:
            if trace:
                print(f"  -> MATCH FOUND at index {mid}!")
            return mid, comparisons
        if value < key:
            low = mid + 1
            if trace:
                print(f"  -> {value} < {key}: Discarding left half. New low = {low}")
        else:
            high = mid - 1
            if trace:
                print(f"  -> {value} > {key}: Discarding right half. New high = {high}")
    if trace:
        print("  -> Search range empty. Target roll number not found.")
    return -1, comparisons

def timed_search(fn, arr: list, key: int):
    """Executes a search function and measures execution time in microseconds."""
    start = perf_counter()
    index, comparisons = fn(arr, key)
    elapsed_us = (perf_counter() - start) * 1_000_000
    return index, comparisons, elapsed_us

def print_result(student: Student):
    """Print an authentic Student Result Card to the console."""
    print("\n" + "=" * 56)
    print("              STUDENT RESULT CARD")
    print("=" * 56)
    print(f"Roll Number : {student.roll_no}")
    print(f"Name        : {student.name}")
    print("-" * 56)
    print(f"{'Subject':<32}{'Marks Obtained':>24}")
    print("-" * 56)
    for subject, mark in zip(SUBJECTS, student.marks):
        print(f"{subject:<32}{mark:>20}/100")
    print("-" * 56)
    print(f"{'Total Marks':<32}{student.total:>20}/500")
    print(f"{'Percentage':<32}{student.percentage:>23.2f}%")
    print(f"{'Final Grade':<32}{student.grade:>24}")
    print(f"{'Result Status':<32}{student.status:>24}")
    print("=" * 56)

def search_and_compare(students: list, key: int):
    """Run both Linear Search and Binary Search on the same key and compare metrics."""
    li, lc, lt = timed_search(linear_search, students, key)
    bi, bc, bt = timed_search(binary_search, students, key)

    print("\n" + "=" * 65)
    print(" SEARCH PERFORMANCE COMPARISON")
    print("=" * 65)
    print(f"Target Roll Number : {key}")
    print(f"Dataset Size       : {len(students):,} records")
    print("-" * 65)
    print(f"{'Algorithm':<16} | {'Result':<10} | {'Comparisons':<14} | {'Time (µs)':<12}")
    print("-" * 65)
    print(f"{'Linear Search':<16} | {'Found' if li >= 0 else 'Not Found':<10} | {lc:<14,} | {lt:<12.3f}")
    print(f"{'Binary Search':<16} | {'Found' if bi >= 0 else 'Not Found':<10} | {bc:<14,} | {bt:<12.3f}")
    print("-" * 65)

    if li != bi:
        print("WARNING: Results differ! Ensure that dataset roll numbers are strictly sorted.")

    # Comparisons comparison
    if lc > bc:
        ratio = lc / max(1, bc)
        print(f">> Binary Search required {lc - bc:,} FEWER comparisons ({ratio:.1f}x more efficient).")
    elif bc > lc:
        print(f">> Linear Search required {bc - lc:,} FEWER comparisons (target at very beginning).")
    else:
        print(">> Comparison counts are identical (target at index 0 and mid happened to align).")

    if li >= 0:
        print_result(students[li])
    else:
        print(f"\nStudent with Roll Number {key} was not found in the dataset.")

def display_first_n(students: list):
    """Display tabular view of the first N student records."""
    if not students:
        print("No dataset loaded. Generate or load data first.")
        return
    try:
        n = int(input(f"How many students should be displayed (1 - {len(students):,}): ").strip())
        if n <= 0: raise ValueError
    except ValueError:
        print("Please enter a positive whole number.")
        return
    n = min(n, len(students))
    print(f"\n{'Roll No':<10}{'Name':<24}{'Total':>8}{'Percent':>11}{'Grade':>7}{'Status':>8}")
    print("-" * 70)
    for s in students[:n]:
        print(f"{s.roll_no:<10}{s.name:<24}{s.total:>4}/500 {s.percentage:>8.2f}%{s.grade:>7}{s.status:>8}")

def save_csv(students: list, filename: str):
    """Save the in-memory dataset to a CSV file."""
    with open(filename, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["roll_no", "name", *SUBJECTS, "total", "percentage", "grade", "status"])
        for s in students:
            w.writerow([s.roll_no, s.name, *s.marks, s.total, s.percentage, s.grade, s.status])
    print(f"Successfully saved {len(students):,} records to '{filename}'.")

def load_csv(filename: str) -> list:
    """Load and validate student records from a CSV file."""
    loaded = []
    with open(filename, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        required = {"roll_no", "name", *SUBJECTS}
        if not reader.fieldnames or not required.issubset(reader.fieldnames):
            raise ValueError(f"CSV missing required columns: {required}")
        for line, row in enumerate(reader, start=2):
            try:
                roll = int(row["roll_no"])
                marks = [int(row[sub]) for sub in SUBJECTS]
            except (ValueError, TypeError) as exc:
                raise ValueError(f"Invalid integer roll or marks at line {line}.") from exc
            if roll < 0 or any(m < 0 or m > 100 for m in marks):
                raise ValueError(f"Out of range roll or mark values at line {line}.")
            total = sum(marks)
            pct = round(total / len(SUBJECTS), 2)
            status = "Pass" if all(m >= 35 for m in marks) else "Fail"
            loaded.append(Student(roll, row["name"].strip(), marks, total, pct, grade_for(pct), status))

    loaded.sort(key=lambda s: s.roll_no)
    rolls = [s.roll_no for s in loaded]
    if len(rolls) != len(set(rolls)):
        raise ValueError("CSV contains duplicate roll numbers.")
    return loaded

def benchmark():
    """Run an empirical benchmark across sizes (100, 1K, 10K, 100K) with 1004 trials per size."""
    rng = Random(2026)
    rows = []
    print("\n" + "=" * 78)
    print(" EMPIRICAL PERFORMANCE BENCHMARK (1,004 search queries per size)")
    print("=" * 78)
    print(f"{'Size':>8} | {'Cases':>5} | {'Linear cmp':>11} | {'Binary cmp':>11} | {'Linear µs':>12} | {'Binary µs':>12}")
    print("-" * 78)
    for size in SIZES:
        data = generate_data(size, seed=size + 100)
        first, middle, last = data[0].roll_no, data[size // 2].roll_no, data[-1].roll_no
        # Test boundary cases + 1,000 random samples
        targets = [first, middle, last, last + 999999]
        targets += [rng.randint(first, last) for _ in range(1000)]
        sums = [0, 0, 0.0, 0.0]
        for key in targets:
            li, lc, lt = timed_search(linear_search, data, key)
            bi, bc, bt = timed_search(binary_search, data, key)
            if li != bi: raise RuntimeError("Search algorithms returned different results!")
            sums[0] += lc; sums[1] += bc; sums[2] += lt; sums[3] += bt
        count = len(targets)
        row = (size, sums[0]/count, sums[1]/count, sums[2]/count, sums[3]/count)
        rows.append(row)
        print(f"{size:>8,} | {count:>5} | {row[1]:>11.2f} | {row[2]:>11.2f} | {row[3]:>12.3f} | {row[4]:>12.3f}")
    print("-" * 78)
    print("Key Takeaway: Binary search comparisons grow logarithmically (O(log n)),")
    print("whereas Linear search comparisons grow linearly (O(n)) with dataset size.")
    return rows

def plot_benchmarks(rows: list):
    """Plot comparative benchmark curves using Matplotlib."""
    try:
        import matplotlib.pyplot as plt
    except ImportError:
        print("\nMatplotlib is not installed. To generate plots, run:")
        print("  pip install matplotlib")
        return
    sizes = [r[0] for r in rows]
    fig, axes = plt.subplots(1, 2, figsize=(14, 5.5))

    # Comparisons Plot
    axes[0].plot(sizes, [r[1] for r in rows], marker="o", color="#e63946", lw=2, label="Linear Search O(n)")
    axes[0].plot(sizes, [r[2] for r in rows], marker="s", color="#2a9d8f", lw=2, label="Binary Search O(log n)")
    axes[0].set_title("Input Size vs Average Comparisons", fontsize=12, fontweight="bold")
    axes[0].set_xlabel("Number of Student Records (n)", fontsize=11)
    axes[0].set_ylabel("Average Comparisons", fontsize=11)
    axes[0].set_xscale("log")
    axes[0].grid(True, alpha=0.3, linestyle="--")
    axes[0].legend(fontsize=10)

    # Execution Time Plot
    axes[1].plot(sizes, [r[3] for r in rows], marker="o", color="#e63946", lw=2, label="Linear Search O(n)")
    axes[1].plot(sizes, [r[4] for r in rows], marker="s", color="#2a9d8f", lw=2, label="Binary Search O(log n)")
    axes[1].set_title("Input Size vs Average Execution Time", fontsize=12, fontweight="bold")
    axes[1].set_xlabel("Number of Student Records (n)", fontsize=11)
    axes[1].set_ylabel("Average Time (µs)", fontsize=11)
    axes[1].set_xscale("log")
    axes[1].set_yscale("log")
    axes[1].grid(True, alpha=0.3, which="both", linestyle="--")
    axes[1].legend(fontsize=10)

    fig.suptitle("Student Result Search: Linear vs Binary Search Performance", fontsize=14, fontweight="bold")
    fig.tight_layout()
    fig.savefig("search_benchmark.png", dpi=180, bbox_inches="tight")
    print("\nBenchmark chart saved as 'search_benchmark.png'.")
    plt.show()

def complexity_table():
    """Print theoretical Big-O time and space complexity comparison table."""
    print("\n" + "=" * 70)
    print(" THEORETICAL TIME & SPACE COMPLEXITY MATRIX")
    print("=" * 70)
    print(f"{'Algorithm':<18}{'Best Case':<14}{'Average Case':<16}{'Worst Case':<14}{'Aux Space':<10}")
    print("-" * 70)
    print(f"{'Linear Search':<18}{'O(1)':<14}{'O(n)':<16}{'O(n)':<14}{'O(1)':<10}")
    print(f"{'Binary Search':<18}{'O(1)':<14}{'O(log n)':<16}{'O(log n)':<14}{'O(1)':<10}")
    print("-" * 70)
    print("• Best Case   : Target found on first check (Linear: index 0; Binary: mid).")
    print("• Average Case: Linear checks n/2 elements; Binary checks ~ log2(n) elements.")
    print("• Worst Case  : Target at end or absent (Linear checks n; Binary checks log2(n)+1).")
    print("• Constraint  : Binary Search STRICTLY requires the dataset to be sorted.")
    print("=" * 70)

def main():
    students = generate_data(1000) # Default initial dataset
    last_benchmark = None
    print(f"Initialized with {len(students):,} student records (sorted roll numbers {students[0].roll_no} - {students[-1].roll_no}).")

    while True:
        print("\n" + "=" * 65)
        print("  STUDENT RESULT SEARCH SYSTEM (COLLEGE PROJECT MODEL)")
        print("  Comparing Linear Search vs Binary Search on Sorted Roll Numbers")
        print("=" * 65)
        print("  1. Generate Student Dataset (100 / 1,000 / 10,000 / 100,000)")
        print("  2. Display First N Student Records")
        print("  3. Search Roll Number using BOTH Algorithms (Performance Compare)")
        print("  4. Run Empirical Benchmark Across All Dataset Sizes")
        print("  5. Plot Benchmark Graphs (Matplotlib)")
        print("  6. Save Current Dataset to CSV")
        print("  7. Load Dataset from CSV")
        print("  8. Show Theoretical Complexity Table")
        print("  9. Binary Search Step-by-Step Trace")
        print("  0. Exit")
        print("=" * 65)
        choice = input("Enter choice (0-9): ").strip()

        if choice == "1":
            raw = input("Enter dataset size (100, 1000, 10000, 100000): ").strip().replace(",", "")
            try:
                size = int(raw)
                if size not in SIZES: raise ValueError
            except ValueError:
                print("Invalid size. Please choose 100, 1000, 10000, or 100000.")
                continue
            students = generate_data(size)
            print(f"Generated {len(students):,} student records with sorted roll numbers [{students[0].roll_no} - {students[-1].roll_no}].")
        elif choice == "2":
            display_first_n(students)
        elif choice in ("3", "9"):
            if not students:
                print("Generate or load a dataset first.")
                continue
            raw = input("Enter roll number to search: ").strip()
            if not raw:
                print("Input cannot be empty.")
                continue
            try:
                key = int(raw)
                if key < 0: raise ValueError
            except ValueError:
                print("Roll number must be a non-negative integer.")
                continue
            if choice == "3":
                search_and_compare(students, key)
            else:
                index, comparisons = binary_search(students, key, trace=True)
                print(f"Trace summary: Final index = {index}, Total comparisons = {comparisons}.")
        elif choice == "4":
            last_benchmark = benchmark()
        elif choice == "5":
            if last_benchmark is None:
                print("Running benchmark first...")
                last_benchmark = benchmark()
            plot_benchmarks(last_benchmark)
        elif choice == "6":
            if not students:
                print("Generate or load a dataset first.")
                continue
            filename = input("Enter CSV filename [students.csv]: ").strip() or "students.csv"
            try:
                save_csv(students, filename)
            except OSError as exc:
                print(f"Could not save file: {exc}")
        elif choice == "7":
            filename = input("Enter CSV filename to load: ").strip()
            if not filename:
                print("Filename cannot be empty.")
                continue
            try:
                students = load_csv(filename)
                print(f"Successfully loaded {len(students):,} records from '{filename}'.")
            except (OSError, ValueError, csv.Error) as exc:
                print(f"Failed to load CSV: {exc}")
        elif choice == "8":
            complexity_table()
        elif choice == "0":
            print("\nThank you for exploring the Student Result Search System. Good luck with your project presentation!")
            break
        else:
            print("Invalid selection. Please enter a number between 0 and 9.")

if __name__ == "__main__":
    main()
