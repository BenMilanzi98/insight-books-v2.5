"use client";

import React, { useState, useEffect } from "react";
import { 
  Shield,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileText,
  Download,
  Calendar,
  User,
  Database,
  Lock,
  Eye,
  RefreshCw,
  TrendingUp,
  Info
} from "lucide-react";

const SecurityCompliancePage = () => {
  const [complianceData, setComplianceData] = useState({
    overallScore: null,
    policies: [],
    auditRequirements: [],
    lastAssessment: null,
    nextAssessment: null,
    scoreNote: null,
  });
  const [loadError, setLoadError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFramework, setSelectedFramework] = useState('general');

  useEffect(() => {
    fetchComplianceData();
  }, [selectedFramework]);

  const fetchComplianceData = async () => {
    try {
      setIsLoading(true);
      setLoadError('');
      const response = await fetch(`/api/admin/security/compliance?framework=${selectedFramework}`, {
        credentials: 'include',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || `Failed to load (${response.status})`);
      }
      setComplianceData(
        data.compliance || {
          overallScore: null,
          policies: [],
          auditRequirements: [],
          lastAssessment: null,
          nextAssessment: null,
        }
      );
    } catch (error) {
      console.error('Failed to fetch compliance data:', error);
      setLoadError(error.message || 'Failed to load compliance signals');
      setComplianceData({
        overallScore: null,
        policies: [],
        auditRequirements: [],
        lastAssessment: null,
        nextAssessment: null,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getComplianceScoreColor = (score) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getComplianceScoreBg = (score) => {
    if (score >= 90) return 'bg-green-100';
    if (score >= 70) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  const getPolicyStatusIcon = (status) => {
    switch (status) {
      case 'compliant':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'non-compliant':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'partial':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      default:
        return <Info className="h-5 w-5 text-gray-500" />;
    }
  };

  const getPolicyStatusBadge = (status) => {
    const statusColors = {
      'compliant': 'bg-green-100 text-green-800',
      'non-compliant': 'bg-red-100 text-red-800',
      'partial': 'bg-yellow-100 text-yellow-800',
      'pending': 'bg-gray-100 text-gray-800'
    };
    return statusColors[status] || 'bg-gray-100 text-gray-800';
  };

  const exportComplianceReport = () => {
    const reportData = {
      framework: selectedFramework,
      overallScore: complianceData.overallScore,
      assessmentDate: new Date().toISOString(),
      policies: complianceData.policies,
      auditRequirements: complianceData.auditRequirements
    };

    const csvContent = "data:text/csv;charset=utf-8," + 
      "Policy,Status,Description,Last Reviewed\n" +
      complianceData.policies.map(policy => 
        `${policy.name},${policy.status},${policy.description},${policy.lastReviewed || 'N/A'}`
      ).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `compliance_report_${selectedFramework}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Security Compliance</h1>
          <p className="text-sm text-gray-500">Monitor compliance status and policy adherence</p>
        </div>
        <div className="flex items-center space-x-3">
          <select
            value={selectedFramework}
            onChange={(e) => setSelectedFramework(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="general">General Security</option>
            <option value="gdpr">GDPR</option>
            <option value="sox">SOX</option>
            <option value="iso27001">ISO 27001</option>
            <option value="pci">PCI DSS</option>
          </select>
          <button
            onClick={exportComplianceReport}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </button>
          <button
            onClick={fetchComplianceData}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      {/* Compliance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className={`p-2 rounded-lg ${getComplianceScoreBg(complianceData.overallScore ?? 0)}`}>
              <Shield className={`h-6 w-6 ${getComplianceScoreColor(complianceData.overallScore ?? 0)}`} />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Overall Score</p>
              <p className={`text-2xl font-bold ${getComplianceScoreColor(complianceData.overallScore ?? 0)}`}>
                {complianceData.overallScore == null ? '—' : `${complianceData.overallScore}%`}
              </p>
              {loadError ? <p className="text-xs text-red-600">{loadError}</p> : null}
              {complianceData.scoreNote ? (
                <p className="text-xs text-gray-500 max-w-xs">{complianceData.scoreNote}</p>
              ) : null}
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Compliant</p>
              <p className="text-2xl font-bold text-green-600">
                {complianceData.policies.filter(p => p.status === 'compliant').length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Partial</p>
              <p className="text-2xl font-bold text-yellow-600">
                {complianceData.policies.filter(p => p.status === 'partial').length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <XCircle className="h-6 w-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Non-Compliant</p>
              <p className="text-2xl font-bold text-red-600">
                {complianceData.policies.filter(p => p.status === 'non-compliant').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Assessment Timeline */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 flex items-center">
            <Calendar className="h-5 w-5 mr-2 text-gray-600" />
            Assessment Timeline
          </h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Last Assessment</h4>
              <p className="text-lg font-semibold text-gray-900">
                {complianceData.lastAssessment ? 
                  new Date(complianceData.lastAssessment).toLocaleDateString() : 
                  'Not available'
                }
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Score:{' '}
                {complianceData.overallScore == null ? 'n/a' : `${complianceData.overallScore}%`}
              </p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Next Assessment</h4>
              <p className="text-lg font-semibold text-gray-900">
                {complianceData.nextAssessment ? 
                  new Date(complianceData.nextAssessment).toLocaleDateString() : 
                  'Not scheduled'
                }
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {complianceData.nextAssessment ? 
                  `${Math.ceil((new Date(complianceData.nextAssessment) - new Date()) / (1000 * 60 * 60 * 24))} days remaining` : 
                  'Schedule required'
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Policy Compliance */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 flex items-center">
            <FileText className="h-5 w-5 mr-2 text-gray-600" />
            Policy Compliance
          </h3>
        </div>
        <div className="p-6">
          {complianceData.policies && complianceData.policies.length > 0 ? (
            <div className="space-y-4">
              {complianceData.policies.map((policy, index) => (
                <div key={index} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center space-x-4">
                    {getPolicyStatusIcon(policy.status)}
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">{policy.name}</h4>
                      <p className="text-sm text-gray-600 mt-1">{policy.description}</p>
                      {policy.lastReviewed && (
                        <p className="text-xs text-gray-500 mt-1">
                          Last reviewed: {new Date(policy.lastReviewed).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPolicyStatusBadge(policy.status)}`}>
                      {policy.status.replace('-', ' ').toUpperCase()}
                    </span>
                    {policy.requirements && (
                      <span className="text-xs text-gray-500">
                        {policy.requirements.length} requirements
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No policies found</p>
              <p className="text-sm text-gray-400 mt-1">Policies will appear here once configured</p>
            </div>
          )}
        </div>
      </div>

      {/* Audit Requirements */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 flex items-center">
            <Eye className="h-5 w-5 mr-2 text-gray-600" />
            Audit Requirements
          </h3>
        </div>
        <div className="p-6">
          {complianceData.auditRequirements && complianceData.auditRequirements.length > 0 ? (
            <div className="space-y-4">
              {complianceData.auditRequirements.map((requirement, index) => (
                <div key={index} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className={`p-2 rounded-full ${
                      requirement.status === 'completed' ? 'bg-green-100' : 
                      requirement.status === 'in-progress' ? 'bg-yellow-100' : 'bg-gray-100'
                    }`}>
                      {requirement.status === 'completed' ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : requirement.status === 'in-progress' ? (
                        <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      ) : (
                        <Info className="h-4 w-4 text-gray-600" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">{requirement.name}</h4>
                      <p className="text-sm text-gray-600 mt-1">{requirement.description}</p>
                      {requirement.dueDate && (
                        <p className="text-xs text-gray-500 mt-1">
                          Due: {new Date(requirement.dueDate).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      requirement.status === 'completed' ? 'bg-green-100 text-green-800' :
                      requirement.status === 'in-progress' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {requirement.status.replace('-', ' ').toUpperCase()}
                    </span>
                    {requirement.priority && (
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        requirement.priority === 'high' ? 'bg-red-100 text-red-800' :
                        requirement.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {requirement.priority.toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Eye className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No audit requirements found</p>
              <p className="text-sm text-gray-400 mt-1">Audit requirements will appear here once configured</p>
            </div>
          )}
        </div>
      </div>

      {/* Compliance Recommendations */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 flex items-center">
            <TrendingUp className="h-5 w-5 mr-2 text-gray-600" />
            Recommendations
          </h3>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            {complianceData.overallScore != null && complianceData.overallScore < 90 ? (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                <div className="flex items-center">
                  <AlertTriangle className="h-5 w-5 text-yellow-400 mr-3" />
                  <div>
                    <h4 className="text-sm font-medium text-yellow-800">Improve Compliance Score</h4>
                    <p className="text-sm text-yellow-700 mt-1">
                      Your current compliance score is {complianceData.overallScore}%.
                      Focus on addressing non-compliant policies to reach 90%+ compliance.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
            
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
              <div className="flex items-center">
                <Info className="h-5 w-5 text-blue-400 mr-3" />
                <div>
                  <h4 className="text-sm font-medium text-blue-800">Regular Assessments</h4>
                  <p className="text-sm text-blue-700 mt-1">
                    Schedule regular compliance assessments to maintain high standards and identify areas for improvement.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-green-50 border border-green-200 rounded-md">
              <div className="flex items-center">
                <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                <div>
                  <h4 className="text-sm font-medium text-green-800">Documentation</h4>
                  <p className="text-sm text-green-700 mt-1">
                    Maintain comprehensive documentation of all security policies and procedures for audit purposes.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecurityCompliancePage; 