"use client";

import { createContext, useCallback, useContext, useState } from "react";

/** @type {React.Context<{ openWizard: (stepId?: string) => void, closeWizard: () => void } | null>} */
const SetupWizardContext = createContext(null);

export function SetupWizardProvider({ children }) {
  const [open, setOpen] = useState(false);
  const [initialStepId, setInitialStepId] = useState(null);

  const openWizard = useCallback((stepId) => {
    if (stepId) setInitialStepId(stepId);
    else setInitialStepId(null);
    setOpen(true);
  }, []);

  const closeWizard = useCallback(() => {
    setOpen(false);
    setInitialStepId(null);
  }, []);

  return (
    <SetupWizardContext.Provider value={{ openWizard, closeWizard, open, initialStepId }}>
      {children}
    </SetupWizardContext.Provider>
  );
}

export function useSetupWizard() {
  const ctx = useContext(SetupWizardContext);
  return {
    openWizard: ctx?.openWizard ?? (() => {}),
    closeWizard: ctx?.closeWizard ?? (() => {}),
    isOpen: ctx?.open ?? false,
  };
}

export function useSetupWizardContext() {
  return useContext(SetupWizardContext);
}
