import PmsFinanceWorkspace, { type PmsFinanceSection } from '../features/pms/finance/PmsFinanceWorkspace';
import PmsFinanceGovernanceWorkspace, { type PmsFinanceGovernanceSection } from '../features/pms/finance/governance/PmsFinanceGovernanceWorkspace';

type PmsFinancialOperationsSection = PmsFinanceSection | PmsFinanceGovernanceSection;

export default function PmsFinancialOperations({ section = 'overview' }: { section?: PmsFinancialOperationsSection }) {
  if (section === 'deposits' || section === 'periods' || section === 'reconciliation') {
    return <PmsFinanceGovernanceWorkspace section={section} />;
  }
  return <PmsFinanceWorkspace section={section} />;
}
