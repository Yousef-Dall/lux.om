import PmsFinanceWorkspace, { type PmsFinanceSection } from '../features/pms/finance/PmsFinanceWorkspace';
import PmsFinanceGovernanceWorkspace, { type PmsFinanceGovernanceSection } from '../features/pms/finance/governance/PmsFinanceGovernanceWorkspace';
import PmsOwnerSettlementWorkspace, { type PmsOwnerSettlementSection } from '../features/pms/finance/settlements/PmsOwnerSettlementWorkspace';

type PmsFinancialOperationsSection = PmsFinanceSection | PmsFinanceGovernanceSection | PmsOwnerSettlementSection;

export default function PmsFinancialOperations({ section = 'overview' }: { section?: PmsFinancialOperationsSection }) {
  if (section === 'deposits' || section === 'periods' || section === 'reconciliation') {
    return <PmsFinanceGovernanceWorkspace section={section} />;
  }
  if (section === 'statements' || section === 'payouts') {
    return <PmsOwnerSettlementWorkspace section={section} />;
  }
  return <PmsFinanceWorkspace section={section} />;
}
