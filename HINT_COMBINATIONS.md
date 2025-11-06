# Hint System - All Possible Combinations

## Hint Structure

- **Hint 1**: Always from VAGUE category
- **Hint 2**: Always from MEDIUM category
- **Hint 3**: Always "Full palette shown"
- **Constraint**: At least one type hint must be included (can be in position 1 or 2)

---

## VAGUE HINTS (Hint 1 Options)

1. **Type - Single Type**

   - "This Pokemon is a [Type]-type Pokemon."

2. **Type - Dual Type (Partial)**

   - "This Pokemon is a part-[Type] type Pokemon."

3. **Evolution Stage**

   - "This Pokemon is a base-stage Pokemon."
   - "This Pokemon is a middle-stage evolution."
   - "This Pokemon is a final-stage evolution."

---

## MEDIUM HINTS (Hint 2 Options)

1. **Type - Single Type**

   - "This Pokemon is a [Type]-type Pokemon."

2. **Type - Dual Type (Full)**

   - "This Pokemon is a [Type1]- and [Type2]-type Pokemon."

3. **Generation**

   - "This Pokemon was introduced in Generation [I-IX]."
   - (Only shown in daily mode OR unlimited mode with multiple generations selected)

---

## SPECIFIC HINTS (Fallback - Only used if needed to fill slots)

1. **Species Category**

   - "This Pokemon is known as the [species]."
   - "This Pokemon is known as the [species] Pokemon."

2. **Description/Flavor Text**
   - (Only if description exists, < 200 chars, and doesn't contain Pokemon name)

---

## Possible Combinations (by Hint Type)

### Pattern 1: Type Hint in Position 1

- **Hint 1**: Type (Vague) - Single or Dual Partial
- **Hint 2**: Any Medium Hint (non-type, since type already covered)
- **Hint 3**: "Full palette shown"

**Examples:**

- Type (single) + Generation + Full palette
- Type (dual partial) + Generation + Full palette
- etc.

### Pattern 2: Type Hint in Position 2

- **Hint 1**: Any Vague Hint (non-type)
- **Hint 2**: Type (Medium) - Single or Dual Full
- **Hint 3**: "Full palette shown"

**Examples:**

- Evolution Stage + Type (single) + Full palette
- Evolution Stage + Type (dual full) + Full palette

### Pattern 3: Type Hint Replaces Non-Type (if no type was selected)

- **Hint 1**: Any Vague Hint (replaced with type if needed)
- **Hint 2**: Any Medium Hint (replaced with type if needed)
- **Hint 3**: "Full palette shown"

This pattern ensures at least one type hint is always present.

---

## Total Possible Combinations

### Vague Hints (2 categories):

- Type (single or dual partial): 2 variants
- Evolution Stage: 3 variants

### Medium Hints (2 categories):

- Type (single or dual full): 2 variants
- Generation: 1 variant (conditional)

### Total Unique Combinations:

Since hints are selected randomly within categories and the system ensures:

1. No duplicate type hints
2. At least one type hint is included
3. Hints are shuffled within categories

**Estimated unique combinations**: Dozens of possible combinations, depending on:

- Pokemon type (single vs dual)
- Pokemon evolution stage
- Game mode (daily vs unlimited)
- Available hint categories for that specific Pokemon

---

## Special Rules

1. **Type Hint Priority**: The system prioritizes including a type hint in the first two positions.

2. **No Duplicate Types**: If a type hint is selected in position 1, position 2 will NOT contain a similar type hint (even if it's worded differently).

3. **Fallback System**: If there aren't enough hints in vague/medium categories, specific hints can be used to fill remaining slots.

4. **Conditional Hints**: Some hints only appear if certain conditions are met:
   - Generation hint: Only in daily mode or unlimited with multiple generations
   - Description hint: Only if description exists and meets criteria
