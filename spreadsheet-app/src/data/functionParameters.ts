/**
 * Registry mapping function names to their parameter names.
 * Each generator function takes an argument index and returns the parameter name.
 */

type ParamGenerator = (index: number) => string;

const FUNCTION_PARAMETERS: Record<string, ParamGenerator> = {
  // --- Logical Functions ---
  "IF": (i) => ["condition", "then", "else"][i] ?? `arg${i}`,
  "IFERROR": (i) => ["value", "value_if_error"][i] ?? `arg${i}`,
  "IFNA": (i) => ["value", "value_if_na"][i] ?? `arg${i}`,
  "IFS": (i) => i % 2 === 0 ? `logical_test${i / 2 + 1}` : `value_if_true${(i + 1) / 2}`,
  "SWITCH": (i) => i === 0 ? "expression" : (i % 2 === 1 ? `value${(i + 1) / 2}` : `result${i / 2}`),
  "AND": (i) => `logical${i + 1}`,
  "OR": (i) => `logical${i + 1}`,
  "XOR": (i) => `logical${i + 1}`,
  "NOT": (i) => ["logical"][i] ?? `arg${i}`,
  "TRUE": () => `arg0`,
  "FALSE": () => `arg0`,

  // --- Lookup & Reference Functions ---
  "VLOOKUP": (i) => ["value to lookup", "in table", "vertical offset", "range_lookup"][i] ?? `arg${i}`,
  "HLOOKUP": (i) => ["value to lookup", "in table", "horizontal offset", "range_lookup"][i] ?? `arg${i}`,
  "INDEX": (i) => ["array", "row_num", "column_num"][i] ?? `arg${i}`,
  "MATCH": (i) => ["lookup_value", "lookup_array", "match_type"][i] ?? `arg${i}`,
  "CHOOSE": (i) => i === 0 ? "index_num" : `value${i}`,
  "OFFSET": (i) => ["reference", "rows", "cols", "height", "width"][i] ?? `arg${i}`,
  "INDIRECT": (i) => ["ref_text", "a1"][i] ?? `arg${i}`,
  "COLUMN": (i) => ["reference"][i] ?? `arg${i}`,
  "ROW": (i) => ["reference"][i] ?? `arg${i}`,
  "COLUMNS": (i) => ["array"][i] ?? `arg${i}`,
  "ROWS": (i) => ["array"][i] ?? `arg${i}`,
  "ADDRESS": (i) => ["row_num", "column_num", "abs_num", "a1", "sheet_text"][i] ?? `arg${i}`,

  // --- Math & Trig Functions ---
  "SUM": (i) => `number${i + 1}`,
  "SUMIF": (i) => ["range", "criteria", "sum_range"][i] ?? `arg${i}`,
  "SUMIFS": (i) => i === 0 ? "sum_range" : (i % 2 === 1 ? `criteria_range${Math.ceil(i / 2)}` : `criteria${i / 2}`),
  "PRODUCT": (i) => `number${i + 1}`,
  "QUOTIENT": (i) => ["numerator", "denominator"][i] ?? `arg${i}`,
  "MOD": (i) => ["number", "divisor"][i] ?? `arg${i}`,
  "ABS": (i) => ["number"][i] ?? `arg${i}`,
  "SQRT": (i) => ["number"][i] ?? `arg${i}`,
  "POWER": (i) => ["number", "power"][i] ?? `arg${i}`,
  "EXP": (i) => ["number"][i] ?? `arg${i}`,
  "LN": (i) => ["number"][i] ?? `arg${i}`,
  "LOG": (i) => ["number", "base"][i] ?? `arg${i}`,
  "LOG10": (i) => ["number"][i] ?? `arg${i}`,
  "INT": (i) => ["number"][i] ?? `arg${i}`,
  "TRUNC": (i) => ["number", "num_digits"][i] ?? `arg${i}`,
  "ROUND": (i) => ["number", "num_digits"][i] ?? `arg${i}`,
  "ROUNDUP": (i) => ["number", "num_digits"][i] ?? `arg${i}`,
  "ROUNDDOWN": (i) => ["number", "num_digits"][i] ?? `arg${i}`,
  "CEILING": (i) => ["number", "significance"][i] ?? `arg${i}`,
  "FLOOR": (i) => ["number", "significance"][i] ?? `arg${i}`,
  "RAND": () => `arg0`,
  "RANDBETWEEN": (i) => ["bottom", "top"][i] ?? `arg${i}`,
  "PI": () => `arg0`,
  "SUBTOTAL": (i) => i === 0 ? "function_num" : `ref${i}`,

  // --- Statistical Functions ---
  "AVERAGE": (i) => `number${i + 1}`,
  "AVERAGEIF": (i) => ["range", "criteria", "average_range"][i] ?? `arg${i}`,
  "AVERAGEIFS": (i) => i === 0 ? "average_range" : (i % 2 === 1 ? `criteria_range${Math.ceil(i / 2)}` : `criteria${i / 2}`),
  "COUNT": (i) => `value${i + 1}`,
  "COUNTA": (i) => `value${i + 1}`,
  "COUNTBLANK": (i) => `range${i + 1}`,
  "COUNTIF": (i) => ["range", "criteria"][i] ?? `arg${i}`,
  "COUNTIFS": (i) => i % 2 === 0 ? `range${i / 2 + 1}` : `criteria for range${(i + 1) / 2}`,
  "MAX": (i) => `number${i + 1}`,
  "MIN": (i) => `number${i + 1}`,
  "MAXIFS": (i) => i === 0 ? "max_range" : (i % 2 === 1 ? `criteria_range${Math.ceil(i / 2)}` : `criteria${i / 2}`),
  "MINIFS": (i) => i === 0 ? "min_range" : (i % 2 === 1 ? `criteria_range${Math.ceil(i / 2)}` : `criteria${i / 2}`),

  // --- Text Functions ---
  "CONCAT": (i) => `text${i + 1}`,
  "CONCATENATE": (i) => `text${i + 1}`,
  "TEXT": (i) => ["value", "format_text"][i] ?? `arg${i}`,
  "LEFT": (i) => ["text", "num_chars"][i] ?? `arg${i}`,
  "RIGHT": (i) => ["text", "num_chars"][i] ?? `arg${i}`,
  "MID": (i) => ["text", "start_num", "num_chars"][i] ?? `arg${i}`,
  "LEN": (i) => ["text"][i] ?? `arg${i}`,
  "FIND": (i) => ["find_text", "within_text", "start_num"][i] ?? `arg${i}`,
  "SEARCH": (i) => ["find_text", "within_text", "start_num"][i] ?? `arg${i}`,
  "SUBSTITUTE": (i) => ["text", "old_text", "new_text", "instance_num"][i] ?? `arg${i}`,
  "REPLACE": (i) => ["old_text", "start_num", "num_chars", "new_text"][i] ?? `arg${i}`,
  "TRIM": (i) => ["text"][i] ?? `arg${i}`,
  "UPPER": (i) => ["text"][i] ?? `arg${i}`,
  "LOWER": (i) => ["text"][i] ?? `arg${i}`,
  "PROPER": (i) => ["text"][i] ?? `arg${i}`,
  "VALUE": (i) => ["text"][i] ?? `arg${i}`,
  "T": (i) => ["value"][i] ?? `arg${i}`,
  "EXACT": (i) => ["text1", "text2"][i] ?? `arg${i}`,

  // --- Date & Time Functions ---
  "TODAY": () => `arg0`,
  "NOW": () => `arg0`,
  "DATE": (i) => ["year", "month", "day"][i] ?? `arg${i}`,
  "TIME": (i) => ["hour", "minute", "second"][i] ?? `arg${i}`,
  "DAY": (i) => ["serial_number"][i] ?? `arg${i}`,
  "MONTH": (i) => ["serial_number"][i] ?? `arg${i}`,
  "YEAR": (i) => ["serial_number"][i] ?? `arg${i}`,
  "HOUR": (i) => ["serial_number"][i] ?? `arg${i}`,
  "MINUTE": (i) => ["serial_number"][i] ?? `arg${i}`,
  "SECOND": (i) => ["serial_number"][i] ?? `arg${i}`,
  "EDATE": (i) => ["start_date", "months"][i] ?? `arg${i}`,
  "EOMONTH": (i) => ["start_date", "months"][i] ?? `arg${i}`,
  "DATEDIF": (i) => ["start_date", "end_date", "unit"][i] ?? `arg${i}`,
  "DAYS": (i) => ["end_date", "start_date"][i] ?? `arg${i}`,
  "NETWORKDAYS": (i) => ["start_date", "end_date", "holidays"][i] ?? `arg${i}`,
  "NETWORKDAYS.INTL": (i) => ["start_date", "end_date", "weekend", "holidays"][i] ?? `arg${i}`,
  "WORKDAY": (i) => ["start_date", "days", "holidays"][i] ?? `arg${i}`,
  "WORKDAY.INTL": (i) => ["start_date", "days", "weekend", "holidays"][i] ?? `arg${i}`,

  // --- Information Functions ---
  "ISBLANK": (i) => ["value"][i] ?? `arg${i}`,
  "ISERROR": (i) => ["value"][i] ?? `arg${i}`,
  "ISERR": (i) => ["value"][i] ?? `arg${i}`,
  "ISNA": (i) => ["value"][i] ?? `arg${i}`,
  "ISLOGICAL": (i) => ["value"][i] ?? `arg${i}`,
  "ISNUMBER": (i) => ["value"][i] ?? `arg${i}`,
  "ISTEXT": (i) => ["value"][i] ?? `arg${i}`,
  "ISNONTEXT": (i) => ["value"][i] ?? `arg${i}`,
  "ISREF": (i) => ["value"][i] ?? `arg${i}`,
};

/**
 * Gets the parameter name for a function argument.
 * @param functionName - The Excel function name (case-insensitive)
 * @param argIndex - The zero-based argument index
 * @returns The parameter name, or a generic "argN" if not found
 */
export function getParameterName(functionName: string, argIndex: number): string {
  const generator = FUNCTION_PARAMETERS[functionName.toUpperCase()];
  if (!generator) return `arg${argIndex}`;
  return generator(argIndex);
}