export type CrmWorkspaceChoice = {
  key: string;
  label: string;
  workspaceId?: string;
  companyId?: string;
  canManage: boolean;
  canManageWorkspace?: boolean;
  propertyScope?: { allProperties: boolean; propertyIds: string[] };
};

export function WorkspaceSelector({
  label,
  value,
  choices,
  onChange
}: {
  label: string;
  value: string;
  choices: CrmWorkspaceChoice[];
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span>{label}</span>
      <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
        {choices.map((choice) => <option key={choice.key} value={choice.key}>{choice.label}</option>)}
      </select>
    </label>
  );
}
