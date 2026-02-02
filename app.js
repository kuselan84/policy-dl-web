const { useMemo, useState, useRef } = React;

const FIELD_CATALOG = [
  { path: "subject.id", type: "string" },
  { path: "subject.type", type: "string" },
  { path: "subject.active", type: "bool" },
  { path: "subject.roles", type: "array", elementType: "string" },
  { path: "subject.relations", type: "array", elementType: "object" },
  { path: "action.name", type: "string" },
  { path: "action.scopes", type: "array", elementType: "string" },
  { path: "resource.id", type: "string" },
  { path: "resource.type", type: "string" },
  { path: "resource.classification", type: "number" },
  { path: "resource.tags", type: "array", elementType: "string" },
  { path: "context.date", type: "date" },
  { path: "context.ip", type: "string" },
];

const DEFAULT_VALUE_BY_TYPE = {
  string: "value",
  number: 0,
  bool: false,
  date: "2025-01-01",
};

const OPERATORS = [
  "is",
  "greater_than",
  "less_than",
  "contains",
  "starts_with",
  "ends_with",
  "has",
];

const CONNECTORS = [
  { value: "and", label: "AND", symbol: "and" },
  { value: "or", label: "OR", symbol: "or" },
];

const HAS_MODES = [
  { value: "value", label: "Value" },
  { value: "expr", label: "Expression" },
];

const SAMPLE_DATA = `{
  "subject": {
    "id": "123",
    "type": "entity",
    "active": true,
    "roles": ["user", "manager"],
    "relations": [
      { "role": "employee", "subject": { "id": "789", "type": "entity" } },
      { "role": "client", "subject": { "id": "999", "type": "entity" } }
    ]
  },
  "action": { "name": "share", "scopes": ["read", "share"] },
  "resource": { "id": "456", "type": "file", "classification": 5, "tags": ["internal", "finance"] },
  "context": { "date": "2025-12-11", "ip": "1.2.3.4" }
}`;

function createClause(id, overrides = {}) {
  return {
    id,
    type: "clause",
    path: "subject.id",
    op: "is",
    valueType: "string",
    value: "value",
    negate: false,
    join: "and",
    hasMode: "value",
    hasItems: [
      {
        id: `${id}-h1`,
        type: "clause",
        path: "role",
        op: "is",
        valueType: "string",
        value: "employee",
        negate: false,
        join: "and",
        hasMode: "value",
        hasItems: [],
      },
    ],
    ...overrides,
  };
}

function createGroup(id) {
  return {
    id,
    type: "group",
    negate: false,
    join: "and",
    items: [createClause(`${id}-c1`)],
  };
}

function getFieldMeta(path) {
  return FIELD_CATALOG.find((field) => field.path === path);
}

function formatValue(type, value) {
  if (type === "string") {
    return `"${value}"`;
  }
  if (type === "bool") {
    return value ? "true" : "false";
  }
  if (type === "date") {
    return value;
  }
  return String(value);
}

function buildExpression(items, indent = 0) {
  const pad = " ".repeat(indent);
  const lines = [];

  items.forEach((item, index) => {
    const expr = buildItem(item, indent);
    if (expr.includes("\n")) {
      lines.push(`${pad}${expr}`);
    } else {
      lines.push(`${pad}${expr}`);
    }

    if (index < items.length - 1) {
      const connector = CONNECTORS.find((c) => c.value === item.join) || CONNECTORS[0];
      lines.push(`${pad}${connector.symbol}`);
    }
  });

  return lines.join("\n");
}

function buildItem(item, indent) {
  if (item.type === "group") {
    const inner = buildExpression(item.items, indent + 2);
    const wrapped = `(${inner ? `\n${inner}\n${" ".repeat(indent)}` : ""})`;
    return item.negate ? `not ${wrapped}` : wrapped;
  }

  const path = item.path.trim() || "path.to.field";
  let expr = "";

  if (item.op === "has") {
    if (item.hasMode === "expr") {
      const inner = buildExpression(item.hasItems, indent + 2);
      expr = `${path} has (${inner ? `\n${inner}\n${" ".repeat(indent)}` : ""})`;
    } else {
      expr = `${path} has ${formatValue(item.valueType, item.value)}`;
    }
  } else {
    expr = `${path} ${item.op} ${formatValue(item.valueType, item.value)}`;
  }

  return item.negate ? `not ${expr}` : expr;
}

function ConnectorSelect({ value, onChange }) {
  return (
    <select
      className="mono rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold tracking-widest text-slate-600"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {CONNECTORS.map((connector) => (
        <option key={connector.value} value={connector.value}>
          {connector.label}
        </option>
      ))}
    </select>
  );
}

function ClauseEditor({ clause, onChange, onRemove, allowRemove }) {
  const fieldMeta = getFieldMeta(clause.path);
  const derivedType = fieldMeta?.type || clause.valueType;
  const valueType = derivedType === "array" ? fieldMeta?.elementType || "string" : derivedType;
  const showValueInput = clause.op !== "has" || clause.hasMode === "value";

  const updateClause = (updates) => {
    onChange({ ...clause, ...updates });
  };

  const handlePathChange = (event) => {
    const nextPath = event.target.value;
    const nextMeta = getFieldMeta(nextPath);
    let nextValueType = clause.valueType;

    if (nextMeta?.type === "array") {
      nextValueType = nextMeta.elementType || "string";
    } else if (nextMeta?.type) {
      nextValueType = nextMeta.type;
    }

    updateClause({
      path: nextPath,
      valueType: nextValueType,
      value: DEFAULT_VALUE_BY_TYPE[nextValueType] ?? clause.value,
    });
  };

  const handleOpChange = (event) => {
    const nextOp = event.target.value;
    updateClause({
      op: nextOp,
      hasMode: nextOp === "has" ? clause.hasMode : "value",
    });
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          className="mono w-44 rounded-xl border border-slate-200 px-3 py-2 text-sm"
          list="fields"
          value={clause.path}
          onChange={handlePathChange}
          placeholder="path.to.field"
        />
        <select
          className="mono rounded-xl border border-slate-200 px-3 py-2 text-sm"
          value={clause.op}
          onChange={handleOpChange}
        >
          {OPERATORS.map((op) => (
            <option key={op} value={op}>
              {op}
            </option>
          ))}
        </select>
        {clause.op === "has" && (
          <select
            className="mono rounded-xl border border-slate-200 px-3 py-2 text-sm"
            value={clause.hasMode}
            onChange={(event) => updateClause({ hasMode: event.target.value })}
          >
            {HAS_MODES.map((mode) => (
              <option key={mode.value} value={mode.value}>
                {mode.label}
              </option>
            ))}
          </select>
        )}
        {showValueInput && (
          <>
            {valueType === "bool" ? (
              <select
                className="mono rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={String(clause.value)}
                onChange={(event) =>
                  updateClause({ valueType, value: event.target.value === "true" })
                }
              >
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            ) : (
              <input
                className="mono w-40 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                type={valueType === "number" ? "number" : valueType === "date" ? "date" : "text"}
                value={clause.value}
                onChange={(event) =>
                  updateClause({ valueType, value: event.target.value })
                }
              />
            )}
          </>
        )}
        <button
          className={`rounded-full border px-3 py-1 text-xs font-semibold ${
            clause.negate
              ? "border-orange-200 bg-orange-100 text-orange-700"
              : "border-slate-200 text-slate-600"
          }`}
          onClick={() => updateClause({ negate: !clause.negate })}
          type="button"
        >
          NOT
        </button>
        {allowRemove && (
          <button
            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
            onClick={onRemove}
            type="button"
          >
            Remove
          </button>
        )}
      </div>

      {clause.op === "has" && clause.hasMode === "expr" && (
        <div className="mt-4 rounded-xl border border-dashed border-orange-200 bg-orange-50 p-3">
          <div className="mb-3 flex items-center justify-between">
            <span className="mono text-xs font-semibold uppercase tracking-widest text-orange-600">
              has expression
            </span>
          </div>
          <ItemsEditor
            items={clause.hasItems}
            onChange={(items) => updateClause({ hasItems: items })}
            allowGroups={true}
          />
        </div>
      )}
    </div>
  );
}

function GroupEditor({ group, onChange, onRemove, allowRemove }) {
  const updateGroup = (updates) => {
    onChange({ ...group, ...updates });
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/70 p-4">
      <div className="mb-4 flex items-center gap-3">
        <span className="chip">Group</span>
        <button
          className={`rounded-full border px-3 py-1 text-xs font-semibold ${
            group.negate
              ? "border-orange-200 bg-orange-100 text-orange-700"
              : "border-slate-200 text-slate-600"
          }`}
          onClick={() => updateGroup({ negate: !group.negate })}
          type="button"
        >
          NOT
        </button>
        {allowRemove && (
          <button
            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
            onClick={onRemove}
            type="button"
          >
            Remove
          </button>
        )}
      </div>
      <ItemsEditor
        items={group.items}
        onChange={(items) => updateGroup({ items })}
        allowGroups={true}
      />
    </div>
  );
}

function ItemsEditor({ items, onChange, allowGroups }) {
  const updateItem = (index, updater) => {
    const next = items.map((item, idx) => (idx === index ? updater(item) : item));
    onChange(next);
  };

  const removeItem = (index) => {
    const next = items.filter((_, idx) => idx !== index);
    if (next.length === 0) {
      onChange([createClause(`auto-${Date.now()}`)]);
      return;
    }
    onChange(next);
  };

  const addClause = () => {
    onChange([...items, createClause(`auto-${Date.now()}`)]);
  };

  const addGroup = () => {
    onChange([...items, createGroup(`auto-${Date.now()}`)]);
  };

  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <div key={item.id} className="space-y-2">
          {item.type === "group" ? (
            <GroupEditor
              group={item}
              onChange={(nextGroup) => updateItem(index, () => nextGroup)}
              onRemove={() => removeItem(index)}
              allowRemove={items.length > 1}
            />
          ) : (
            <ClauseEditor
              clause={item}
              onChange={(nextClause) => updateItem(index, () => nextClause)}
              onRemove={() => removeItem(index)}
              allowRemove={items.length > 1}
            />
          )}

          {index < items.length - 1 && (
            <ConnectorSelect
              value={item.join}
              onChange={(value) => updateItem(index, (current) => ({ ...current, join: value }))}
            />
          )}
        </div>
      ))}

      <div className="flex flex-wrap gap-3">
        <button className="btn-ghost rounded-full px-4 py-2 text-sm" onClick={addClause} type="button">
          Add clause
        </button>
        {allowGroups && (
          <button className="btn-ghost rounded-full px-4 py-2 text-sm" onClick={addGroup} type="button">
            Add group
          </button>
        )}
      </div>
    </div>
  );
}

function App() {
  const idCounter = useRef(1);
  const [items, setItems] = useState([createClause(`base-${idCounter.current}`)]);
  const [scratchpad, setScratchpad] = useState("");
  const [ruleEffect, setRuleEffect] = useState("allow");

  const dslOutput = useMemo(
    () => `${ruleEffect} if ${buildExpression(items)}`,
    [items, ruleEffect]
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(dslOutput);
    } catch (error) {
      setScratchpad(dslOutput);
    }
  };

  const handleLoadToScratchpad = () => {
    setScratchpad(dslOutput);
  };

  return (
    <div className="px-6 py-10">
      <datalist id="fields">
        {FIELD_CATALOG.map((field) => (
          <option key={field.path} value={field.path} />
        ))}
      </datalist>

      <header className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <div className="chip mb-3 inline-flex">Rule Composer</div>
            <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
              Build Policy Decision Language with confidence.
            </h1>
            <p className="mt-3 max-w-xl text-base text-slate-600">
              Assemble clauses, group logic with parentheses, and preview the exact
              syntax the parser expects.
            </p>
          </div>
          <div className="card glow w-full max-w-sm px-6 py-5">
            <p className="text-sm font-semibold text-slate-500">Sample context</p>
            <pre className="mono mt-3 max-h-40 overflow-auto text-xs text-slate-700">
              {SAMPLE_DATA}
            </pre>
          </div>
        </div>
      </header>

      <main className="mx-auto mt-10 grid max-w-6xl gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="card p-6">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Rule builder</h2>
            <div className="flex items-center gap-3">
              <span className="chip">PDL v1</span>
              <div className="flex rounded-full border border-slate-200 bg-slate-50 p-1 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                <button
                  className={`rounded-full px-3 py-1 ${
                    ruleEffect === "allow"
                      ? "bg-slate-900 text-white"
                      : "text-slate-500"
                  }`}
                  onClick={() => setRuleEffect("allow")}
                  type="button"
                  aria-pressed={ruleEffect === "allow"}
                >
                  Allow
                </button>
                <button
                  className={`rounded-full px-3 py-1 ${
                    ruleEffect === "deny"
                      ? "bg-slate-900 text-white"
                      : "text-slate-500"
                  }`}
                  onClick={() => setRuleEffect("deny")}
                  type="button"
                  aria-pressed={ruleEffect === "deny"}
                >
                  Deny
                </button>
              </div>
            </div>
          </div>
          <ItemsEditor items={items} onChange={setItems} allowGroups={true} />
        </section>

        <aside className="space-y-6">
          <div className="card p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Generated PDL</h3>
              <button
                className="btn-accent rounded-full px-4 py-2 text-sm font-semibold"
                onClick={handleCopy}
                type="button"
              >
                Copy
              </button>
            </div>
            <pre className="mono mt-4 max-h-[320px] overflow-auto whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs">
              {dslOutput}
            </pre>
            <button
              className="btn-ghost mt-4 w-full rounded-full px-4 py-2 text-sm"
              onClick={handleLoadToScratchpad}
              type="button"
            >
              Send to scratchpad
            </button>
          </div>

          <div className="card p-6">
            <h3 className="text-lg font-semibold">Scratchpad</h3>
            <p className="mt-2 text-sm text-slate-500">
              Tweak the generated PDL or paste existing rules. This does not sync back
              into the builder.
            </p>
            <textarea
              className="mono mt-4 h-48 w-full resize-none rounded-2xl border border-slate-200 bg-white p-4 text-xs"
              value={scratchpad}
              onChange={(event) => setScratchpad(event.target.value)}
            />
          </div>

          <div className="card p-6">
            <h3 className="text-lg font-semibold">Operator cheat sheet</h3>
            <div className="mt-4 grid gap-3 text-sm text-slate-600">
              <div className="flex items-center justify-between">
                <span className="mono">is</span>
                <span>Equality</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="mono">greater_than</span>
                <span>Numbers or dates</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="mono">less_than</span>
                <span>Numbers or dates</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="mono">contains</span>
                <span>String contains</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="mono">starts_with</span>
                <span>String prefix</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="mono">ends_with</span>
                <span>String suffix</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="mono">has</span>
                <span>Array membership</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="mono">not</span>
                <span>NOT</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="mono">and</span>
                <span>AND</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="mono">or</span>
                <span>OR</span>
              </div>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
