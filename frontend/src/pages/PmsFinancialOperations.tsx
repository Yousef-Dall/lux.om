import PmsFinanceWorkspace, { type PmsFinanceSection } from '../features/pms/finance/PmsFinanceWorkspace';

export default function PmsFinancialOperations({ section = 'overview' }: { section?: PmsFinanceSection }) {
  return <PmsFinanceWorkspace section={section} />;
}
