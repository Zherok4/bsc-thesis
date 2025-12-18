/**
 * Registry mapping function names to their parameter names.
 * Each generator function takes an argument index and returns the parameter name.
 */

type ParamGenerator = (index: number) => string;

const FUNCTION_PARAMETERS: Record<string, ParamGenerator> = {
  // Fixed arguments
  "IF": (i) => ["condition", "value_if_true", "value_if_false"][i] ?? `arg${i}`,
  "VLOOKUP": (i) => ["lookup_value", "table_array", "col_index_num", "range_lookup"][i] ?? `arg${i}`,
  "HLOOKUP": (i) => ["lookup_value", "table_array", "row_index_num", "range_lookup"][i] ?? `arg${i}`,
  "INDEX": (i) => ["array", "row_num", "col_num"][i] ?? `arg${i}`,
  "MATCH": (i) => ["lookup_value", "lookup_array", "match_type"][i] ?? `arg${i}`,
  "SUMIF": (i) => ["range", "criteria", "sum_range"][i] ?? `arg${i}`,
  "COUNTIF": (i) => ["range", "criteria"][i] ?? `arg${i}`,
  "AVERAGEIF": (i) => ["range", "criteria", "average_range"][i] ?? `arg${i}`,
  "IFERROR": (i) => ["value", "value_if_error"][i] ?? `arg${i}`,
  "IFNA": (i) => ["value", "value_if_na"][i] ?? `arg${i}`,
  "ROUND": (i) => ["number", "num_digits"][i] ?? `arg${i}`,
  "ROUNDUP": (i) => ["number", "num_digits"][i] ?? `arg${i}`,
  "ROUNDDOWN": (i) => ["number", "num_digits"][i] ?? `arg${i}`,
  "LEFT": (i) => ["text", "num_chars"][i] ?? `arg${i}`,
  "RIGHT": (i) => ["text", "num_chars"][i] ?? `arg${i}`,
  "MID": (i) => ["text", "start_num", "num_chars"][i] ?? `arg${i}`,
  "LEN": (i) => ["text"][i] ?? `arg${i}`,
  "TRIM": (i) => ["text"][i] ?? `arg${i}`,
  "UPPER": (i) => ["text"][i] ?? `arg${i}`,
  "LOWER": (i) => ["text"][i] ?? `arg${i}`,
  "PROPER": (i) => ["text"][i] ?? `arg${i}`,
  "SUBSTITUTE": (i) => ["text", "old_text", "new_text", "instance_num"][i] ?? `arg${i}`,
  "REPLACE": (i) => ["old_text", "start_num", "num_chars", "new_text"][i] ?? `arg${i}`,
  "FIND": (i) => ["find_text", "within_text", "start_num"][i] ?? `arg${i}`,
  "SEARCH": (i) => ["find_text", "within_text", "start_num"][i] ?? `arg${i}`,
  "ABS": (i) => ["number"][i] ?? `arg${i}`,
  "SQRT": (i) => ["number"][i] ?? `arg${i}`,
  "POWER": (i) => ["number", "power"][i] ?? `arg${i}`,
  "MOD": (i) => ["number", "divisor"][i] ?? `arg${i}`,
  "INT": (i) => ["number"][i] ?? `arg${i}`,
  "FLOOR": (i) => ["number", "significance"][i] ?? `arg${i}`,
  "CEILING": (i) => ["number", "significance"][i] ?? `arg${i}`,
  "RAND": () => `arg0`,
  "RANDBETWEEN": (i) => ["bottom", "top"][i] ?? `arg${i}`,
  "TODAY": () => `arg0`,
  "NOW": () => `arg0`,
  "DATE": (i) => ["year", "month", "day"][i] ?? `arg${i}`,
  "YEAR": (i) => ["serial_number"][i] ?? `arg${i}`,
  "MONTH": (i) => ["serial_number"][i] ?? `arg${i}`,
  "DAY": (i) => ["serial_number"][i] ?? `arg${i}`,
  "HOUR": (i) => ["serial_number"][i] ?? `arg${i}`,
  "MINUTE": (i) => ["serial_number"][i] ?? `arg${i}`,
  "SECOND": (i) => ["serial_number"][i] ?? `arg${i}`,
  "DATEDIF": (i) => ["start_date", "end_date", "unit"][i] ?? `arg${i}`,
  "EOMONTH": (i) => ["start_date", "months"][i] ?? `arg${i}`,
  "NETWORKDAYS": (i) => ["start_date", "end_date", "holidays"][i] ?? `arg${i}`,
  "WORKDAY": (i) => ["start_date", "days", "holidays"][i] ?? `arg${i}`,
  "TEXT": (i) => ["value", "format_text"][i] ?? `arg${i}`,
  "VALUE": (i) => ["text"][i] ?? `arg${i}`,
  "ISBLANK": (i) => ["value"][i] ?? `arg${i}`,
  "ISERROR": (i) => ["value"][i] ?? `arg${i}`,
  "ISNA": (i) => ["value"][i] ?? `arg${i}`,
  "ISNUMBER": (i) => ["value"][i] ?? `arg${i}`,
  "ISTEXT": (i) => ["value"][i] ?? `arg${i}`,
  "NOT": (i) => ["logical"][i] ?? `arg${i}`,

  // Variable arguments
  "SUM": (i) => `number${i + 1}`,
  "AVERAGE": (i) => `number${i + 1}`,
  "COUNT": (i) => `value${i + 1}`,
  "COUNTA": (i) => `value${i + 1}`,
  "COUNTBLANK": (i) => `range${i + 1}`,
  "MAX": (i) => `number${i + 1}`,
  "MIN": (i) => `number${i + 1}`,
  "PRODUCT": (i) => `number${i + 1}`,
  "CONCAT": (i) => `text${i + 1}`,
  "CONCATENATE": (i) => `text${i + 1}`,
  "AND": (i) => `logical${i + 1}`,
  "OR": (i) => `logical${i + 1}`,
  "XOR": (i) => `logical${i + 1}`,
  "CHOOSE": (i) => i === 0 ? "index_num" : `value${i}`,
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
