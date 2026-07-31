/**
 * Safe formula evaluator — no eval / Function.
 * Supports: number literals, identifiers from context, + - * /, parentheses, min/max.
 */

import { parseMoney, roundMoney } from '@/lib/money';

function tokenize(expr) {
  const tokens = [];
  const s = String(expr || '').trim();
  if (!s) return tokens;
  let m;
  const re = /([()+*/,])|(-?\d+(?:\.\d+)?)|([A-Za-z_][A-Za-z0-9_]*)|(\s+)/g;
  while ((m = re.exec(s)) !== null) {
    if (m[4]) continue;
    if (m[1]) tokens.push({ type: 'op', value: m[1] });
    else if (m[2]) tokens.push({ type: 'num', value: Number(m[2]) });
    else if (m[3]) tokens.push({ type: 'id', value: m[3] });
  }
  return tokens;
}

/**
 * Evaluate a simple arithmetic expression against a numeric context.
 * @param {string|object} expression string like "basicSalary + overtimePay" or AST {op,args}
 * @param {Record<string, number>} context
 */
export function evaluateFormula(expression, context = {}) {
  if (expression != null && typeof expression === 'object' && !Array.isArray(expression)) {
    return evaluateAst(expression, context);
  }
  return evaluateString(String(expression || '0'), context);
}

function evaluateAst(node, context) {
  if (node == null) return 0;
  if (typeof node === 'number') return roundMoney(node);
  if (typeof node === 'string') {
    if (Object.prototype.hasOwnProperty.call(context, node)) {
      return parseMoney(context[node]);
    }
    return parseMoney(node);
  }
  const op = String(node.op || '').toLowerCase();
  const args = Array.isArray(node.args) ? node.args.map((a) => evaluateAst(a, context)) : [];
  switch (op) {
    case 'add':
      return roundMoney(args.reduce((a, b) => a + b, 0));
    case 'sub':
      return roundMoney((args[0] || 0) - (args[1] || 0));
    case 'mul':
      return roundMoney(args.reduce((a, b) => a * b, 1));
    case 'div':
      if (!args[1]) throw new Error('Division by zero in formula');
      return roundMoney(args[0] / args[1]);
    case 'min':
      return roundMoney(Math.min(...args));
    case 'max':
      return roundMoney(Math.max(...args));
    case 'lit':
      return parseMoney(node.value);
    case 'ref':
      return parseMoney(context[node.name] ?? 0);
    default:
      throw new Error(`Unsupported formula op "${op}"`);
  }
}

function evaluateString(expr, context) {
  const tokens = tokenize(expr);
  let i = 0;

  function peek() {
    return tokens[i];
  }
  function next() {
    return tokens[i++];
  }

  function parsePrimary() {
    const t = next();
    if (!t) throw new Error('Unexpected end of formula');
    if (t.type === 'num') return t.value;
    if (t.type === 'id') {
      const name = t.value;
      if (name === 'min' || name === 'max') {
        if (!peek() || peek().value !== '(') throw new Error(`Expected ( after ${name}`);
        next();
        const args = [parseExpr()];
        while (peek() && peek().value === ',') {
          next();
          args.push(parseExpr());
        }
        if (!peek() || peek().value !== ')') throw new Error('Expected )');
        next();
        return name === 'min' ? Math.min(...args) : Math.max(...args);
      }
      if (!Object.prototype.hasOwnProperty.call(context, name)) {
        throw new Error(`Unknown identifier "${name}" in formula`);
      }
      return parseMoney(context[name]);
    }
    if (t.value === '(') {
      const v = parseExpr();
      if (!peek() || peek().value !== ')') throw new Error('Expected )');
      next();
      return v;
    }
    if (t.value === '-') return -parsePrimary();
    throw new Error(`Unexpected token ${t.value}`);
  }

  function parseMul() {
    let v = parsePrimary();
    while (peek() && (peek().value === '*' || peek().value === '/')) {
      const op = next().value;
      const r = parsePrimary();
      if (op === '*') v *= r;
      else {
        if (!r) throw new Error('Division by zero in formula');
        v /= r;
      }
    }
    return v;
  }

  function parseExpr() {
    let v = parseMul();
    while (peek() && (peek().value === '+' || peek().value === '-')) {
      const op = next().value;
      const r = parseMul();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  }

  const result = parseExpr();
  if (i < tokens.length) throw new Error('Unexpected trailing tokens in formula');
  return roundMoney(result);
}

export function validateFormulaExpression(expression, allowedIds = []) {
  try {
    const ctx = Object.fromEntries(allowedIds.map((id) => [id, 1]));
    evaluateFormula(expression, ctx);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
