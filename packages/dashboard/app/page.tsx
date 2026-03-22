import { AgentStatusStreamProvider } from "../components/agent-status-stream";
import RangerDashboard from "../components/ranger-dashboard";

export default function HomePage() {
  return (
    <AgentStatusStreamProvider>
      <RangerDashboard />
    </AgentStatusStreamProvider>
  );
}
