import { useState } from "react";
import { ChevronDown, X, Plus, Palette, ArrowUpDown, Equal, ArrowUp, ArrowDown } from "lucide-react";
import { ColorPicker } from "../ColorPicker";
import { CustomDropdown } from "../CustomDropdown";
import { WhiteDropdown } from "../WhiteDropdown";

interface Rule {
  id: string;
  evaluateField: string; // Field to evaluate for this rule
  condition: string;
  value: string;
  value2?: string; // Second value for "between" condition
  color: string;
}

export interface ConditionalRule {
  id: string;
  evaluateField: string;
  condition: string;
  value: string;
  value2?: string;
  color: string;
}

interface ConditionalFormattingSectionProps {
  xAxisFields?: string[];
  yAxisFields?: string[];
  rules?: ConditionalRule[];
  onRulesChange?: (rules: ConditionalRule[]) => void;
}

export default function ConditionalFormattingSection({
  xAxisFields = [],
  yAxisFields = [],
  rules: rulesProp,
  onRulesChange,
}: ConditionalFormattingSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [evaluateField, setEvaluateField] = useState("");
  const [localRules, setLocalRules] = useState<Rule[]>([
    { id: "1", evaluateField: "", condition: "greater", value: "", color: "#ef4444" }
  ]);
  const rules = rulesProp ?? localRules;
  const setRules = (newRules: Rule[] | ((prev: Rule[]) => Rule[])) => {
    const resolved = typeof newRules === 'function' ? newRules(rules) : newRules;
    setLocalRules(resolved);
    onRulesChange?.(resolved);
  };

  // Legend state
  const [isLegendOpen, setIsLegendOpen] = useState(false);
  const [legendPosition, setLegendPosition] = useState("right");
  const [legendBold, setLegendBold] = useState(false);
  const [legendItalic, setLegendItalic] = useState(false);
  const [legendTextColor, setLegendTextColor] = useState("auto");

  const conditionOptions = [
    { value: "isNull", label: "Is null", icon: ArrowUp },
    { value: "isNotNull", label: "Is not null", icon: ArrowDown },
    { value: "greater", label: "Greater than", icon: ArrowUp },
    { value: "greaterEqual", label: "Greater than or equal", icon: ArrowUpDown },
    { value: "less", label: "Less than", icon: ArrowDown },
    { value: "lessEqual", label: "Less than or equal", icon: ArrowUpDown },
    { value: "equal", label: "Is equal to", icon: Equal },
    { value: "notEqual", label: "Is not equal", icon: X },
    { value: "between", label: "Is between", icon: ArrowUpDown },
    { value: "contains", label: "Contains", icon: ArrowUpDown },
    { value: "notContain", label: "Does not contain", icon: X }
  ];

  // Combine X and Y axis fields for the evaluate dropdown
  const allFields = [...xAxisFields, ...yAxisFields];

  // Prepare groups for the evaluate field dropdown
  const evaluateFieldGroups = allFields.length > 0 ? [
    ...(xAxisFields.length > 0 ? [{
      label: "X-Axis Fields",
      options: xAxisFields.map(field => ({ value: field, label: field }))
    }] : []),
    ...(yAxisFields.length > 0 ? [{
      label: "Y-Axis Fields",
      options: yAxisFields.map(field => ({ value: field, label: field }))
    }] : [])
  ] : [{
    label: "",
    options: [
      { value: "Invoice Amount (₹)", label: "Invoice Amount (₹)" },
      { value: "Duplicate Count", label: "Duplicate Count" },
      { value: "Duplicate Score (%)", label: "Duplicate Score (%)" },
      { value: "Amount at Risk (₹)", label: "Amount at Risk (₹)" }
    ]
  }];

  const addRule = () => {
    const newRule: Rule = {
      id: String(Date.now()),
      evaluateField: "",
      condition: "greater",
      value: "",
      color: "#ef4444"
    };
    setRules([...rules, newRule]);
  };

  const removeRule = (id: string) => {
    if (rules.length > 1) {
      setRules(rules.filter(rule => rule.id !== id));
    }
  };

  const updateRule = (id: string, field: keyof Rule, value: string) => {
    setRules(rules.map(rule => 
      rule.id === id ? { ...rule, [field]: value } : rule
    ));
  };

  const getConditionIcon = (conditionValue: string) => {
    const option = conditionOptions.find(opt => opt.value === conditionValue);
    return option ? option.icon : ArrowUpDown;
  };

  return (
    <div className="bg-white rounded-[8px] border border-[#e5e7eb] overflow-hidden shadow-sm mt-3">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-gradient-to-r from-[#faf5ff] to-white hover:from-[#f5f0ff] hover:to-[#fefefe] transition-all border-b border-[#f0f0f0]"
      >
        <div className="flex items-center gap-2">
          <div className="size-[18px] rounded-[4px] flex items-center justify-center">
            <Palette className="size-[12px] text-[#6a12cd]" strokeWidth={2} />
          </div>
          <span className="text-[0.75rem] font-bold uppercase tracking-[0.8px] text-[#26064a]">Conditional Formatting</span>
        </div>
        <ChevronDown
          className="size-[14px] text-[#6a12cd] transition-transform duration-200"
          style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>
      {isOpen && (
        <div className="p-3 bg-[#fafafa] space-y-3">
          {/* Evaluate Field */}
          

          {/* Rules Section */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-[0.75rem] font-semibold text-[#26064a]">Rules</label>
              <span className="text-[0.625rem] text-[#64748b] font-medium">{rules.length} active</span>
            </div>
            <div className="space-y-2">
              {rules.map((rule, index) => {
                const ConditionIcon = getConditionIcon(rule.condition);
                return (
                  <div key={rule.id} className="bg-white rounded-[8px] p-3 border border-[#e5e7eb] shadow-sm space-y-2.5">
                    {/* Rule Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        
                        <span className="text-[0.75rem] font-semibold text-[#26064a]">
                          Rule {index + 1}
                        </span>
                      </div>
                      {rules.length > 1 && (
                        <button
                          onClick={() => removeRule(rule.id)}
                          className="size-[24px] flex items-center justify-center rounded-[4px] hover:bg-red-50 transition-colors group"
                        >
                          <X className="size-[14px] text-[#94a3b8] group-hover:text-red-500" strokeWidth={2} />
                        </button>
                      )}
                    </div>

                    {/* Evaluate Field for this rule */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[0.75rem] font-semibold text-[#26064a]">Evaluate Field</label>
                      <CustomDropdown
                        value={rule.evaluateField}
                        onChange={(value) => updateRule(rule.id, "evaluateField", value)}
                        groups={evaluateFieldGroups}
                        placeholder="Select field to evaluate..."
                      />
                    </div>

                    {/* Condition */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[0.75rem] font-semibold text-[#26064a]">Condition</label>
                      <WhiteDropdown
                        value={rule.condition}
                        onChange={(value) => updateRule(rule.id, "condition", value)}
                        options={conditionOptions}
                        size="sm"
                      />
                    </div>

                    {/* Value and Color */}
                    {rule.condition === "between" ? (
                      // Show two value fields and color in separate rows for "between" condition
                      <>
                        {/* Two value fields in one row */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex flex-col gap-1">
                            <label className="text-[0.75rem] font-semibold text-[#26064a]">From</label>
                            <input
                              type="text"
                              value={rule.value}
                              onChange={(e) => updateRule(rule.id, "value", e.target.value)}
                              placeholder="Min value"
                              className="w-full px-2.5 py-2 text-[0.75rem] bg-white border border-[#e5e7eb] rounded-[6px] text-[#26064a] placeholder:text-[#cbd5e1] focus:outline-none focus:border-[#6a12cd] focus:ring-1 focus:ring-[#6a12cd] transition-all shadow-sm"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-[0.75rem] font-semibold text-[#26064a]">To</label>
                            <input
                              type="text"
                              value={rule.value2 || ""}
                              onChange={(e) => updateRule(rule.id, "value2", e.target.value)}
                              placeholder="Max value"
                              className="w-full px-2.5 py-2 text-[0.75rem] bg-white border border-[#e5e7eb] rounded-[6px] text-[#26064a] placeholder:text-[#cbd5e1] focus:outline-none focus:border-[#6a12cd] focus:ring-1 focus:ring-[#6a12cd] transition-all shadow-sm"
                            />
                          </div>
                        </div>
                        {/* Color field in second row */}
                        <div className="flex flex-col gap-1">
                          <label className="text-[0.75rem] font-semibold text-[#26064a]">Color</label>
                          <WhiteDropdown
                            value={rule.color}
                            onChange={(value) => updateRule(rule.id, "color", value)}
                            mode="colorpicker"
                            placeholder="Select color..."
                            size="sm"
                          />
                        </div>
                      </>
                    ) : (
                      // Default layout: Value and Color side by side
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col gap-1">
                          <label className="text-[0.75rem] font-semibold text-[#26064a]">Value</label>
                          <input
                            type="text"
                            value={rule.value}
                            onChange={(e) => updateRule(rule.id, "value", e.target.value)}
                            placeholder="Enter value"
                            className="w-full px-2.5 py-2 text-[0.75rem] bg-white border border-[#e5e7eb] rounded-[6px] text-[#26064a] placeholder:text-[#cbd5e1] focus:outline-none focus:border-[#6a12cd] focus:ring-1 focus:ring-[#6a12cd] transition-all shadow-sm"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[0.75rem] font-semibold text-[#26064a]">Color</label>
                          <WhiteDropdown
                            value={rule.color}
                            onChange={(value) => updateRule(rule.id, "color", value)}
                            mode="colorpicker"
                            placeholder="Select color..."
                            size="sm"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Add Condition Button */}
          <button
            onClick={addRule}
            className="relative w-full py-2.5 rounded-[8px] bg-white border border-[#6a12cd] border-dashed text-[#6a12cd] text-[0.75rem] font-semibold flex items-center justify-center gap-2 hover:bg-[#faf5ff] active:bg-[#f5f0ff] transition-all shadow-[0px_1px_2px_0px_rgba(0,0,0,0.1)] px-[0px] py-[10px]"
          >
            <Plus className="size-[14px]" strokeWidth={2.5} />
            Add Condition
          </button>
        </div>
      )}
    </div>
  );
}