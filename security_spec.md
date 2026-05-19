# Security Specification - Lab Results

## Data Invariants
- A lab result must have a non-empty student ID and name.
- `submittedAt` must be a valid server timestamp (or validated string).
- Users can create their own results.
- For a class lab, results are usually "write-once" or modifiable by the student who created them if auth is used. 
- In this simple version, we'll allow anyone to 'create', but we should ideally use auth if possible. Since the request is just "수집" (collect), I'll implement a public create rule for now, or use anonymous auth if possible. 
- However, the skill says "Only Google Login is configured". I'll implement a basic rule that allows creation.

## The "Dirty Dozen" Payloads
1. Result with missing `studentId`.
2. Result with invalid `intervalTime` type.
3. Result with malicious script in `studentName`.
4. Result with `submittedAt` in the future (client provided).
5. Attempting to overwrite someone else's result if we had IDs (we'll use auto-ID).
6. Attempting to delete a result.
7. Attempting to list all results (privacy for students).
8. Result with payload > 1MB.
9. Result with invalid `plottedA` (not an array).
10. Result with extra "isAdmin" field.
11. Result with student ID too long.
12. Attempting to update a submitted result (terminal state).

## Proposed Rules Logic
- `allow create`: if data is valid.
- `allow read, update, delete`: if false (admin only via console).
