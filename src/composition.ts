import { FoundationUseCases } from "./application/use-cases.js";
import type { ApplicationDependencies } from "./application/ports.js";
import { FixedClock, InMemoryEventBus, InMemoryRepositories, IncrementingIds } from "./infrastructure/in-memory.js";

export const createFoundation = (): { useCases: FoundationUseCases; dependencies: ApplicationDependencies } => {
  const repositories = new InMemoryRepositories();
  const dependencies: ApplicationDependencies = {
    workspaces: repositories.workspaces,
    sessions: repositories.sessions,
    approvals: repositories.approvals,
    devices: repositories.devices,
    previews: repositories.previews,
    events: new InMemoryEventBus(),
    clock: new FixedClock(),
    ids: new IncrementingIds(),
  };
  return { useCases: new FoundationUseCases(dependencies), dependencies };
};
