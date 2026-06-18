import { Navigate, Route, Routes } from 'react-router-dom';
import SignInSignUp from '@/components/features/login/page';
import NewChat from '@/components/features/new-chat/page';
import Dashboard from '@/components/features/dashboard/page';
import Help from '@/components/features/help/page';
import Layout from '@/components/Layout';
import Configuration from '@/components/features/configuration/page';
import Workzone from '@/components/features/new-chat/session/Page';
import DashboardDetailsPage from '@/components/features/dashboard/components/DashboardDetailsPage';
import DashboardContentRouter from '@/components/features/dashboard/components/DashboardContentRouter';
import DashboardDetailPageNew from '@/components/features/dashboard/components/DashboardDetailPageNew';
import TestRoute from '@/components/features/testingUI/Page';
import ProtectedRoute from './ProtectedRoute';
import RequireAdmin from './RequireAdmin';
import RbacSetupPage from '@/components/features/admin/rbac-setup/RbacSetupPage';
import DataSource from '@/components/features/configuration/datasource/page';
import ReportsInDatasource from '@/components/features/reports/datasource_reports/Page';
import ReportsPage from '@/components/features/reports/Page';
import TermsModal from '@/components/TermsModal';
import BusinessProcessPage from '@/components/features/business-process/page';
import SingleBusinessProcessPage from '@/components/features/business-process/single-business-process/SingleBusinessProcess';
import SingleReportPage from '@/components/features/reports/single-report/Page';
import FlagExceptionsPage from '@/components/features/reports/single-report/flag-exception-modal/Page';
import ReportCoverPage from '@/components/features/reports/export/cover/Page';
import ReportContentPage from '@/components/features/reports/export/Page';
import HelpMenu from '@/components/elements/HelpMenu';
import WorkflowPageV2 from '@/components/features/business-process/workflow/page-v2';
import Home from '@/components/features/home';
import RACMGeneratorPage from '@/components/features/racm-generator/page';
import AccessManagementPage from '@/components/features/access-management/page';
import AcceptInvitationPage from '@/components/features/invitation/AcceptInvitationPage';
import DeclineInvitationPage from '@/components/features/invitation/DeclineInvitationPage';
import EDABuilderPage from '@/components/features/eda-builder/page';
import DocumentForensicsPage from '@/components/features/document-forensics/page';
import ImageAnalyticsPage from '@/components/features/image-analytics/page';
import AiConciergePage from '@/components/features/ai-concierge/page';
import SpeechAuditorPage from '@/components/features/speech-auditor/page';
import TableExtractorPage from '@/components/features/table-extractor/page';
import MedicalReportReaderPage from '@/components/features/medical-report-reader/page';
import BusinessProcessExecutionLogsPage from '@/components/features/business-process/execution-logs/BusinessProcessExecutionLogsPage';
import CommandPalette from '@/components/elements/CommandPalette';
import ExternalCaseManagementPage from '@/components/features/case-assignment-trail/Page';
import ResolutionTrailPage from '@/components/features/case-assignment-trail/ResolutionTrailPage';

function AppRoutes() {
	return (
		<>
			<TermsModal />
			<CommandPalette />
			<Routes>
				<Route exact path="/" element={<SignInSignUp />} />

				{/* Public invitation routes - no layout or auth */}
				<Route
					path="/accept-invitation"
					element={<AcceptInvitationPage />}
				/>
				<Route
					path="/decline-invitation"
					element={<DeclineInvitationPage />}
				/>
				<Route
					path="/case-assignment"
					element={<ExternalCaseManagementPage />}
				/>
				<Route
					path="/case-assignment-trail"
					element={<ResolutionTrailPage />}
				/>

				<Route
					path="/app/*"
					element={
						<ProtectedRoute
							element={
								<Layout>
									<Routes>
										<Route path="/home" element={<Home />} />
										<Route
											path="/"
											element={<Navigate to="/app/home" />}
										/>
										<Route
											path="new-chat/session"
											element={<Workzone />}
										/>
										<Route
											path="new-chat/*"
											element={<NewChat />}
										/>
										<Route
											path="dashboard"
											element={<Dashboard />}
										/>
										<Route
											path="dashboard/content"
											element={<DashboardDetailPageNew />}
										/>
										<Route
											path="dashboard/*"
											element={<Dashboard />}
										/>
										<Route
											path="configuration/datasource"
											element={<DataSource />}
										/>
										<Route
											path="configuration"
											element={<Configuration />}
										/>
										<Route path="help" element={<Help />} />
										<Route
											path="reports/datasources/report"
											element={<ReportsInDatasource />}
										/>
										<Route
											path="reports"
											element={<ReportsPage />}
										/>
										<Route
											path="reports/:reportId"
											element={<SingleReportPage />}
										/>

										<Route
											path="business-process"
											element={<BusinessProcessPage />}
										/>
										<Route
											path="business-process/:businessProcessId"
											element={<SingleBusinessProcessPage />}
										/>
										<Route
											path="business-process/:businessProcessId/workflows/:workflowId"
											element={<WorkflowPageV2 />}
										/>
										<Route
											path="business-process/:businessProcessId/execution-logs"
											element={
												<BusinessProcessExecutionLogsPage />
											}
										/>
										<Route
											path="access-management"
											element={<AccessManagementPage />}
										/>
										{/* AI Concierge — landing + nested feature pages */}
										<Route
											path="ai-concierge"
											element={
												<ProtectedRoute
													element={<AiConciergePage />}
												/>
											}
										/>
										<Route
											path="ai-concierge/racm-generator"
											element={
												<ProtectedRoute
													element={<RACMGeneratorPage />}
												/>
											}
										/>
										<Route
											path="ai-concierge/eda-builder"
											element={
												<ProtectedRoute
													element={<EDABuilderPage />}
												/>
											}
										/>
										<Route
											path="ai-concierge/document-forensics"
											element={
												<ProtectedRoute
													element={
														<DocumentForensicsPage />
													}
												/>
											}
										/>
										<Route
											path="ai-concierge/image-analytics"
											element={
												<ProtectedRoute
													element={<ImageAnalyticsPage />}
												/>
											}
										/>
										<Route
											path="ai-concierge/speech-auditor"
											element={
												<ProtectedRoute
													element={<SpeechAuditorPage />}
												/>
											}
										/>
										<Route
											path="ai-concierge/table-extractor"
											element={
												<ProtectedRoute
													element={<TableExtractorPage />}
												/>
											}
										/>
										<Route
											path="ai-concierge/medical-report-reader"
											element={
												<ProtectedRoute
													element={
														<MedicalReportReaderPage />
													}
												/>
											}
										/>
										{/* Redirects for old bookmarked URLs */}
										<Route
											path="racm-generator"
											element={
												<Navigate
													to="/app/ai-concierge/racm-generator"
													replace
												/>
											}
										/>
										<Route
											path="eda-builder"
											element={
												<Navigate
													to="/app/ai-concierge/eda-builder"
													replace
												/>
											}
										/>
										<Route
											path="document-forensics"
											element={
												<Navigate
													to="/app/ai-concierge/document-forensics"
													replace
												/>
											}
										/>
										{/* Hidden admin-only route — direct URL only, no nav entry */}
										<Route
											path="admin/rbac-setup"
											element={
												<RequireAdmin>
													<RbacSetupPage />
												</RequireAdmin>
											}
										/>
									</Routes>
								</Layout>
							}
						/>
					}
				/>
				<Route
					path="app/reports/:reportId/exceptions/:cardId"
					element={<ProtectedRoute element={<FlagExceptionsPage />} />}
				/>
				<Route
					path="export/reports/:reportId/content"
					element={<ReportContentPage />}
				/>
				<Route
					path="export/reports/:reportId/cover"
					element={<ReportCoverPage />}
				/>
				<Route path="test" element={<TestRoute />} />
				<Route path="*" element={<Navigate to="/" replace />} />
			</Routes>
			{/* {!window.location.pathname.includes('export') && <HelpMenu />} */}
		</>
	);
}

export default AppRoutes;
