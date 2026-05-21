// ─── Configurable Engagement V3 — Creation Wizard ─────────────────────────
// Modal-based creation wizard: Choose Work Type → Details → Pattern Setup → Review & Create
// Landing pages (ComplianceEngagementView, AutomationPortfolioView) and workspaces remain full-page.
// See docs/CONFIGURABLE_ENGAGEMENT_V3_MEMORY.md for product rules.

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, ChevronLeft, CheckCircle2, Info, X, Check } from 'lucide-react';
import type { EngagementPatternType, EngagementConfig, ConfigurableEngagement, ValidationResult } from './configurableEngagementTypes';
import ConfigurableEngagementWorkspace from './ConfigurableEngagementWorkspace';
import {
  EngagementPatternType as EPT, EngagementStatus, PATTERN_DISPLAY_LABELS,
  ComplianceFramework, ControlScopeSource, TestingInputMethod,
  AuditScopeLevel, AutomationInputType, AutomationSetupMode, AutomationOutputType, RunType,
} from './configurableEngagementTypes';
import { getEngagementPatternDefinition } from './engagementPatterns';
import { validateConfigurableEngagementDraft } from './configurableEngagementState';
import { PatternSelectionStep, CommonDetailsStep, PatternConfigStep, ReviewCreateStep } from './components';
import type { CommonDetails } from './components';
import AutomationPortfolioView from './AutomationPortfolioView';
import ComplianceEngagementView from './ComplianceEngagementView';
import InternalAuditAssignmentView from './InternalAuditAssignmentView';
import EngagementLibraryView, { type LibraryEngagement } from './EngagementLibraryView';
import EngagementExecutionV2 from '../engagement-execution-v2/EngagementExecutionV2';

// ─── Step definitions ─────────────────────────────────────────────────────

const STEPS = [
  { id: 'pattern', label: 'Work Type' },
  { id: 'details', label: 'Details' },
  { id: 'config', label: 'Setup' },
  { id: 'review', label: 'Review & Create' },
] as const;

// ─── Default configs per pattern ──────────────────────────────────────────

function getDefaultConfig(patternType: EngagementPatternType): EngagementConfig {
  if (patternType === EPT.COMPLIANCE_CONTROL_TESTING) {
    return {
      patternType: EPT.COMPLIANCE_CONTROL_TESTING,
      framework: ComplianceFramework.SOX_ICFR,
      auditType: 'Financial Internal Control',
      auditPeriodStart: '',
      auditPeriodEnd: '',
      controlScopeSource: ControlScopeSource.RACM_VERSION,
      defaultTestingInputMethod: TestingInputMethod.UPLOAD_SELECTED_SAMPLES,
      allowControlLevelOverride: true,
      reviewerRequired: true,
      requestPbcEnabled: false,
    };
  }
  if (patternType === EPT.INTERNAL_AUDIT_ASSIGNMENT) {
    return {
      patternType: EPT.INTERNAL_AUDIT_ASSIGNMENT,
      auditPeriodStart: '',
      auditPeriodEnd: '',
      scopeLevel: AuditScopeLevel.PROCESS,
      processOwner: '',
      idrEnabled: true,
      announcementRequired: true,
      finalReportRequired: true,
      actionTrackingEnabled: true,
    };
  }
  return {
    patternType: EPT.WORKFLOW_AUTOMATION_PROJECT,
    inputType: AutomationInputType.EXCEL_CSV,
    automationSetupMode: AutomationSetupMode.QA_ADHOC_ANALYSIS,
    outputTypes: [AutomationOutputType.REPORT],
    reportRequired: true,
    reviewRequired: false,
    caseCreationEnabled: false,
    runType: RunType.AD_HOC,
  };
}

const DEFAULT_DETAILS: CommonDetails = {
  name: '',
  description: '',
  owner: '',
  reviewer: '',
  businessProcess: '',
  entityOrLocation: '',
  plannedStartDate: '',
  plannedEndDate: '',
  dataPeriodStart: '',
  dataPeriodEnd: '',
};

// ─── Component ────────────────────────────────────────────────────────────

interface WizardProps {
  onNavigateToView?: (view: any) => void;
}

export default function ConfigurableEngagementWizard({ onNavigateToView }: WizardProps = {}) {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedPattern, setSelectedPattern] = useState<EngagementPatternType | null>(null);
  const [details, setDetails] = useState<CommonDetails>(DEFAULT_DETAILS);
  const [config, setConfig] = useState<EngagementConfig>(getDefaultConfig(EPT.COMPLIANCE_CONTROL_TESTING));
  const [createdEngagement, setCreatedEngagement] = useState<ConfigurableEngagement | null>(null);
  const [showPortfolio, setShowPortfolio] = useState(false);
  const [showComplianceView, setShowComplianceView] = useState(false);
  const [showIAView, setShowIAView] = useState(false);
  const [openedFromPortfolio, setOpenedFromPortfolio] = useState(false);
  const [openedFromComplianceView, setOpenedFromComplianceView] = useState(false);
  const [openedFromIAView, setOpenedFromIAView] = useState(false);
  const [openedFromLibrary, setOpenedFromLibrary] = useState(false);
  const [showWizardModal, setShowWizardModal] = useState(false);

  // When pattern changes, reset config to defaults
  const handlePatternSelect = (pt: EngagementPatternType) => {
    if (pt !== selectedPattern) {
      setConfig(getDefaultConfig(pt));
    }
    setSelectedPattern(pt);
  };

  // Build draft engagement for validation
  const draftEngagement = useMemo<ConfigurableEngagement | null>(() => {
    if (!selectedPattern) return null;
    return {
      id: 'draft-new',
      name: details.name,
      patternType: selectedPattern,
      displayLabel: PATTERN_DISPLAY_LABELS[selectedPattern],
      description: details.description,
      owner: details.owner,
      reviewer: details.reviewer || undefined,
      businessProcess: details.businessProcess || undefined,
      entityOrLocation: details.entityOrLocation || undefined,
      status: EngagementStatus.DRAFT,
      stage: 'Draft',
      plannedStartDate: details.plannedStartDate || undefined,
      plannedEndDate: details.plannedEndDate || undefined,
      dataPeriodStart: details.dataPeriodStart || undefined,
      dataPeriodEnd: details.dataPeriodEnd || undefined,
      config,
      outputs: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }, [selectedPattern, details, config]);

  const validation: ValidationResult = useMemo(() => {
    if (!draftEngagement) return { isValid: false, errors: [{ field: 'patternType', message: 'Select a work type.', severity: 'error' }] };
    return validateConfigurableEngagementDraft(draftEngagement);
  }, [draftEngagement]);

  const reviewerRequired = selectedPattern === EPT.COMPLIANCE_CONTROL_TESTING;

  // ── Open wizard modal ──────────────────────────────────────────────────

  const openWizardModal = (pattern: EngagementPatternType, startStep = 1) => {
    setSelectedPattern(pattern);
    setConfig(getDefaultConfig(pattern));
    setDetails(DEFAULT_DETAILS);
    setCreatedEngagement(null);
    setCurrentStep(startStep);
    setShowWizardModal(true);
  };

  // ── Close wizard modal safely ──────────────────────────────────────────

  const closeWizardModal = () => {
    setShowWizardModal(false);
  };

  // ── Step navigation inside modal ───────────────────────────────────────

  const canGoNext = () => {
    if (currentStep === 0) return !!selectedPattern;
    if (currentStep === 1) return !!details.name.trim() && !!details.owner.trim() && !!details.description.trim();
    if (currentStep === 2) return true;
    return false;
  };

  const handleModalBack = () => {
    if (currentStep <= 1) {
      closeWizardModal();
      return;
    }
    setCurrentStep(s => Math.max(0, s - 1));
  };

  const handleModalNext = () => {
    if (currentStep === 0 && selectedPattern) {
      setCurrentStep(1);
      return;
    }
    setCurrentStep(s => Math.min(3, s + 1));
  };

  // ── Create engagement and close modal ──────────────────────────────────

  const handleCreate = () => {
    if (!validation.isValid || !draftEngagement) return;
    const now = new Date().toISOString();
    const eng: ConfigurableEngagement = {
      ...draftEngagement,
      id: `ceng-${Date.now()}`,
      status: EngagementStatus.DRAFT,
      stage: 'Draft',
      createdAt: now,
      updatedAt: now,
      outputs: getEngagementPatternDefinition(draftEngagement.patternType).requiredOutputs.map((o, i) => ({
        id: `out-${Date.now()}-${i}`,
        type: o,
        label: o,
        status: 'PENDING' as const,
      })),
    };
    setCreatedEngagement(eng);
    setOpenedFromLibrary(true);
    // For compliance engagements, route to EngagementExecutionV2 (controls table workspace)
    if (eng.patternType === EPT.COMPLIANCE_CONTROL_TESTING) {
      setOpenedFromComplianceView(true);
    }
    setShowWizardModal(false);
    setShowComplianceView(false);
    setShowIAView(false);
    setShowPortfolio(false);
  };

  // ── Back from workspace ────────────────────────────────────────────────

  const handleBackToWizard = () => {
    // If opened from unified library, always go back to library (hub)
    if (openedFromLibrary) {
      setCreatedEngagement(null);
      setOpenedFromLibrary(false);
      setOpenedFromComplianceView(false);
      setOpenedFromIAView(false);
      setOpenedFromPortfolio(false);
      return;
    }
    if (openedFromPortfolio) {
      setCreatedEngagement(null);
      setOpenedFromPortfolio(false);
      setShowPortfolio(true);
      return;
    }
    if (createdEngagement?.patternType === EPT.WORKFLOW_AUTOMATION_PROJECT) {
      setCreatedEngagement(null);
      setShowPortfolio(true);
      return;
    }
    if (openedFromComplianceView || createdEngagement?.patternType === EPT.COMPLIANCE_CONTROL_TESTING) {
      setCreatedEngagement(null);
      setOpenedFromComplianceView(false);
      setShowComplianceView(true);
      return;
    }
    if (openedFromIAView || createdEngagement?.patternType === EPT.INTERNAL_AUDIT_ASSIGNMENT) {
      setCreatedEngagement(null);
      setOpenedFromIAView(false);
      setShowIAView(true);
      return;
    }
    // Other — back to hub
    setCreatedEngagement(null);
  };

  // ── Landing page handlers ──────────────────────────────────────────────

  const handleOpenFromComplianceView = (eng: ConfigurableEngagement) => {
    setCreatedEngagement(eng);
    setOpenedFromComplianceView(true);
    setShowComplianceView(false);
  };

  const handleOpenFromIAView = (eng: ConfigurableEngagement) => {
    setCreatedEngagement(eng);
    setOpenedFromIAView(true);
    setShowIAView(false);
  };

  const handleOpenFromPortfolio = (eng: ConfigurableEngagement) => {
    setCreatedEngagement(eng);
    setOpenedFromPortfolio(true);
    setShowPortfolio(false);
  };

  // ── Modal title ────────────────────────────────────────────────────────

  const modalTitle = useMemo(() => {
    if (!selectedPattern) return 'Create Engagement';
    if (selectedPattern === EPT.COMPLIANCE_CONTROL_TESTING) return 'Plan Engagement';
    if (selectedPattern === EPT.INTERNAL_AUDIT_ASSIGNMENT) return 'Create Audit Assignment';
    return 'Create Automation Project';
  }, [selectedPattern]);

  // ── Hub: unified Engagement Library ────────────────────────────────────

  // Build ConfigurableEngagement from library row and open workspace directly
  const handleOpenFromLibrary = (libEng: LibraryEngagement) => {
    const patternType = libEng.type === 'Compliance' ? EPT.COMPLIANCE_CONTROL_TESTING
      : libEng.type === 'Internal Audit' ? EPT.INTERNAL_AUDIT_ASSIGNMENT
      : EPT.WORKFLOW_AUTOMATION_PROJECT;

    const eng: ConfigurableEngagement = {
      id: libEng.id,
      name: libEng.name,
      patternType,
      displayLabel: libEng.typeLabel,
      description: libEng.description,
      owner: libEng.owner,
      reviewer: libEng.reviewer,
      businessProcess: libEng.process,
      entityOrLocation: libEng.entity,
      status: EngagementStatus.IN_PROGRESS,
      stage: libEng.status,
      config: patternType === EPT.COMPLIANCE_CONTROL_TESTING
        ? { patternType: EPT.COMPLIANCE_CONTROL_TESTING, framework: ComplianceFramework.SOX_ICFR, auditType: 'Financial Internal Control', auditPeriodStart: '', auditPeriodEnd: '', controlScopeSource: ControlScopeSource.RACM_VERSION, defaultTestingInputMethod: TestingInputMethod.UPLOAD_SELECTED_SAMPLES, allowControlLevelOverride: true, reviewerRequired: true, requestPbcEnabled: true }
        : patternType === EPT.INTERNAL_AUDIT_ASSIGNMENT
        ? { patternType: EPT.INTERNAL_AUDIT_ASSIGNMENT, scopeLevel: 'PROCESS' as any, businessProcessId: libEng.process, subProcessId: '', auditPeriodStart: '', auditPeriodEnd: '', sopIds: [], racmVersionId: '', checklistId: '', processOwner: libEng.owner, idrEnabled: true, announcementRequired: true, finalReportRequired: true, actionTrackingEnabled: true }
        : { patternType: EPT.WORKFLOW_AUTOMATION_PROJECT, inputType: 'HYBRID' as any, automationSetupMode: 'SELECT_EXISTING_WORKFLOW' as any, outputTypes: ['REPORT' as any, 'CASE_MANAGEMENT' as any], reportRequired: true, reviewRequired: false, caseCreationEnabled: true, runType: 'AD_HOC' as any, frequency: '' as any },
      outputs: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setOpenedFromLibrary(true);
    if (patternType === EPT.COMPLIANCE_CONTROL_TESTING) {
      handleOpenFromComplianceView(eng);
    } else if (patternType === EPT.INTERNAL_AUDIT_ASSIGNMENT) {
      handleOpenFromIAView(eng);
    } else {
      handleOpenFromPortfolio(eng);
    }
  };

  const renderHub = () => (
    <EngagementLibraryView
      onOpenEngagement={handleOpenFromLibrary}
      onPlanEngagement={() => {
        setCurrentStep(0);
        setShowWizardModal(true);
      }}
    />
  );

  // ── Determine base view ────────────────────────────────────────────────
  // Priority: workspace > landing pages > hub

  const renderBaseView = () => {
    // Workspace views (after engagement opened or created)
    if (createdEngagement && openedFromComplianceView) {
      const complianceConfig = createdEngagement.config.patternType === EPT.COMPLIANCE_CONTROL_TESTING ? createdEngagement.config : null;
      return (
        <EngagementExecutionV2
          engagementId={createdEngagement.id}
          onBack={handleBackToWizard}
          requestPbcEnabled={complianceConfig?.requestPbcEnabled ?? true}
          generateFromPopulation={complianceConfig?.defaultTestingInputMethod === 'GENERATE_SAMPLES_FROM_POPULATION'}
        />
      );
    }
    if (createdEngagement) {
      const isAutomation = createdEngagement.patternType === EPT.WORKFLOW_AUTOMATION_PROJECT;
      const isCompliance = createdEngagement.patternType === EPT.COMPLIANCE_CONTROL_TESTING;
      const isIA = createdEngagement.patternType === EPT.INTERNAL_AUDIT_ASSIGNMENT;
      const backLabel = openedFromLibrary ? 'Back to Engagement Library' : openedFromPortfolio || isAutomation ? 'Back to Automation Projects' : isCompliance ? 'Back to Engagement View' : openedFromIAView || isIA ? 'Back to IA Assignments' : undefined;
      return (
        <div>
          <div className="flex items-start gap-2 px-4 py-2.5 mb-4 rounded-lg bg-blue-50 border border-blue-200 text-[11px] text-blue-700">
            <Info size={13} className="shrink-0 mt-0.5" />
            <span>{openedFromPortfolio ? 'Viewing automation project from portfolio. State is local and not persisted.' : 'Draft created locally. This workspace is dev-only and not persisted. Changes will be lost on page refresh.'}</span>
          </div>
          <ConfigurableEngagementWorkspace
            engagement={createdEngagement}
            onBack={handleBackToWizard}
            backLabel={backLabel}
          />
        </div>
      );
    }

    // Landing pages
    if (showComplianceView) {
      return (
        <ComplianceEngagementView
          onOpenEngagement={handleOpenFromComplianceView}
          onCreateNew={() => openWizardModal(EPT.COMPLIANCE_CONTROL_TESTING)}
          onBack={() => { setShowComplianceView(false); }}
        />
      );
    }
    if (showIAView) {
      return (
        <InternalAuditAssignmentView
          onOpenAssignment={handleOpenFromIAView}
          onCreateNew={() => openWizardModal(EPT.INTERNAL_AUDIT_ASSIGNMENT)}
          onBack={() => { setShowIAView(false); }}
        />
      );
    }
    if (showPortfolio) {
      return (
        <AutomationPortfolioView
          onOpenProject={handleOpenFromPortfolio}
          onCreateNew={() => openWizardModal(EPT.WORKFLOW_AUTOMATION_PROJECT)}
          onBack={() => { setShowPortfolio(false); }}
        />
      );
    }

    // Default: Work Type hub
    return renderHub();
  };

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <>
      {renderBaseView()}

      {/* ── Modal Wizard Overlay ── */}
      <AnimatePresence>
        {showWizardModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
            onClick={closeWizardModal}
          >
            <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              transition={{ duration: 0.18 }}
              role="dialog"
              aria-modal="true"
              aria-label={modalTitle}
              className="relative bg-white rounded-2xl shadow-2xl w-[720px] max-h-[90vh] overflow-hidden flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-border-light flex items-center justify-between shrink-0">
                <h3 className="text-[16px] font-semibold text-text">{modalTitle}</h3>
                <button onClick={closeWizardModal} className="p-1.5 hover:bg-surface-2 rounded-md transition-colors cursor-pointer" aria-label="Close">
                  <X size={16} className="text-text-muted" />
                </button>
              </div>

              {/* Stepper */}
              <div className="px-6 py-3 border-b border-border-light shrink-0">
                <div className="flex items-center w-full">
                  {STEPS.map((step, idx) => {
                    const isActive = idx === currentStep;
                    const isDone = idx < currentStep;
                    return (
                      <React.Fragment key={step.id}>
                        {idx > 0 && <div className={`flex-1 h-px mx-3 ${isDone ? 'bg-primary' : 'bg-border-light'}`} />}
                        <div className="flex items-center gap-2 shrink-0">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-semibold ${
                            isActive ? 'bg-primary text-white' :
                            isDone ? 'bg-primary/15 text-primary' :
                            'bg-surface-2 text-text-muted'
                          }`}>
                            {isDone ? <Check size={13} strokeWidth={3} /> : idx + 1}
                          </div>
                          <span className={`text-[12px] ${
                            isActive ? 'text-text font-semibold' :
                            isDone ? 'text-text' :
                            'text-text-muted'
                          }`}>{step.label}</span>
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>

              {/* Body — scrollable */}
              <div className="flex-1 overflow-y-auto px-6 py-5">
                {currentStep === 0 && (
                  <PatternSelectionStep selectedPattern={selectedPattern} onSelect={handlePatternSelect} />
                )}
                {currentStep === 1 && selectedPattern && (
                  <CommonDetailsStep
                    patternType={selectedPattern}
                    details={details}
                    onChange={setDetails}
                    reviewerRequired={reviewerRequired}
                  />
                )}
                {currentStep === 2 && selectedPattern && (
                  <PatternConfigStep
                    patternType={selectedPattern}
                    config={config}
                    onChange={setConfig}
                  />
                )}
                {currentStep === 3 && selectedPattern && (
                  <ReviewCreateStep
                    patternType={selectedPattern}
                    details={details}
                    config={config}
                    validation={validation}
                    isCreated={false}
                    onCreate={handleCreate}
                  />
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-3 border-t border-border-light shrink-0 flex items-center justify-between">
                <button
                  onClick={handleModalBack}
                  className="flex items-center gap-1 px-4 py-2 rounded-lg border border-border-light text-[12px] font-medium text-text-muted hover:bg-surface-2/30 cursor-pointer transition-colors"
                >
                  <ChevronLeft size={13} />{currentStep <= 1 ? 'Cancel' : 'Back'}
                </button>
                {currentStep < 3 && (
                  <button
                    onClick={handleModalNext}
                    disabled={!canGoNext()}
                    className="flex items-center gap-1 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-[12px] font-semibold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next<ChevronRight size={13} />
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
