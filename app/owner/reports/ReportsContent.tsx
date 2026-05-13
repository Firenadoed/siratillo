// app/owner/reports/ReportsContent.tsx
"use client";

import { useState, useEffect } from "react";
import { 
  Flag, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  User, 
  Mail, 
  Calendar,
  MessageSquare,
  Send,
  RefreshCw,
  ArrowLeft,
  XCircle
} from "lucide-react";
import { Toaster, toast } from "sonner";
import { useBranch } from "@/lib/branchcontext";

interface Report {
  id: string;
  type: string;
  description: string;
  status: "pending" | "in_progress" | "resolved" | "rejected";
  customer_name: string;
  customer_email: string;
  created_at: string;
  resolved_at: string | null;
  notes: string | null;
  user_id?: string;
  shop_id?: string;
  branch_id?: string;
}

export default function ReportsContent() {
  const { selectedBranch } = useBranch();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    if (selectedBranch) {
      fetchReports();
    }
  }, [selectedBranch]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/owner/reports?branch_id=${selectedBranch?.id}`);
      const data = await response.json();
      
      if (response.ok) {
        setReports(data.reports || []);
      } else {
        toast.error(data.error || "Failed to fetch reports");
      }
    } catch (error) {
      console.error("Error fetching reports:", error);
      toast.error("Failed to load reports");
    } finally {
      setLoading(false);
    }
  };

  const updateReportStatus = async (reportId: string, status: string) => {
    try {
      const response = await fetch("/api/owner/reports", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId, status })
      });

      if (response.ok) {
        toast.success(`Report marked as ${status}`);
        fetchReports();
        if (selectedReport?.id === reportId) {
          setSelectedReport({ ...selectedReport, status: status as any });
        }
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to update status");
      }
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    }
  };

  const sendReply = async () => {
    if (!replyText.trim() || !selectedReport) return;
    
    setSending(true);
    try {
      const response = await fetch("/api/owner/reports/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportId: selectedReport.id,
          message: replyText,
          customerEmail: selectedReport.customer_email,
          customerName: selectedReport.customer_name
        })
      });

      if (response.ok) {
        toast.success("Reply sent to customer");
        setReplyText("");
        fetchReports();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to send reply");
      }
    } catch (error) {
      console.error("Error sending reply:", error);
      toast.error("Failed to send reply");
    } finally {
      setSending(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800 flex items-center gap-1"><Clock className="w-3 h-3" /> Pending</span>;
      case "in_progress":
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> In Progress</span>;
      case "resolved":
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Resolved</span>;
      case "rejected":
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800 flex items-center gap-1"><XCircle className="w-3 h-3" /> Rejected</span>;
      default:
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">{status}</span>;
    }
  };

  const getTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      "Broken machine": "🔧",
      "Payment issue": "💰",
      "Delivery problem": "🚚",
      "Cleanliness issue": "🧹",
      "Staff concern": "👥",
      "Other issue": "📝"
    };
    return icons[type] || "📋";
  };

  const filteredReports = reports.filter(report => {
    if (filter === "all") return true;
    return report.status === filter;
  });

  const stats = {
    total: reports.length,
    pending: reports.filter(r => r.status === "pending").length,
    inProgress: reports.filter(r => r.status === "in_progress").length,
    resolved: reports.filter(r => r.status === "resolved").length
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading reports...</p>
        </div>
      </div>
    );
  }

  if (!selectedBranch) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-lg">Please select a branch to view reports</p>
        <p className="text-gray-400 mt-2">Use the branch selector in the sidebar</p>
      </div>
    );
  }

  return (
    <>
      <Toaster position="top-right" richColors />
      
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <Flag className="w-6 h-6 text-orange-500" />
                Issue Reports
              </h1>
              <p className="text-gray-500 mt-1">Manage and respond to customer issues</p>
            </div>
            <button
              onClick={fetchReports}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
            <p className="text-sm text-gray-500">Total Reports</p>
          </div>
          <div className="bg-yellow-50 rounded-lg p-4 shadow-sm border border-yellow-200">
            <p className="text-2xl font-bold text-yellow-800">{stats.pending}</p>
            <p className="text-sm text-yellow-600">Pending</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-4 shadow-sm border border-blue-200">
            <p className="text-2xl font-bold text-blue-800">{stats.inProgress}</p>
            <p className="text-sm text-blue-600">In Progress</p>
          </div>
          <div className="bg-green-50 rounded-lg p-4 shadow-sm border border-green-200">
            <p className="text-2xl font-bold text-green-800">{stats.resolved}</p>
            <p className="text-sm text-green-600">Resolved</p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-200">
          {["all", "pending", "in_progress", "resolved", "rejected"].map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-4 py-2 text-sm font-medium transition ${
                filter === tab
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1).replace("_", " ")}
            </button>
          ))}
        </div>

        {/* Reports List */}
        {filteredReports.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <Flag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No reports found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Reports List */}
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
              {filteredReports.map((report) => (
                <div
                  key={report.id}
                  onClick={() => setSelectedReport(report)}
                  className={`bg-white rounded-lg p-4 shadow-sm border cursor-pointer transition hover:shadow-md ${
                    selectedReport?.id === report.id
                      ? "border-blue-500 ring-2 ring-blue-200"
                      : "border-gray-200"
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{getTypeIcon(report.type)}</span>
                      <span className="font-medium text-gray-800">{report.type}</span>
                    </div>
                    {getStatusBadge(report.status)}
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                    {report.description}
                  </p>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center gap-2">
                      <User className="w-3 h-3" />
                      <span>{report.customer_name || "Guest"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3 h-3" />
                      <span>{new Date(report.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Report Details & Reply */}
            {selectedReport ? (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden sticky top-4">
                <div className="p-4 border-b border-gray-200 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-800">Report Details</h3>
                    <button
                      onClick={() => setSelectedReport(null)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="p-4 space-y-4 max-h-[500px] overflow-y-auto">
                  {/* Customer Info */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-gray-500">Customer Information</h4>
                    <div className="space-y-1 text-sm bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <span>{selectedReport.customer_name || "Guest User"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-gray-400" />
                        <span className="text-blue-600">{selectedReport.customer_email || "No email"}</span>
                      </div>
                      <div className="flex items-center gap-2 pt-2 border-t border-gray-200 mt-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span>{new Date(selectedReport.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Issue Details */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-gray-500">Issue Details</h4>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedReport.description}</p>
                    </div>
                  </div>

                  {/* Status Update */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-gray-500">Update Status</h4>
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => updateReportStatus(selectedReport.id, "pending")}
                        className={`px-3 py-1.5 text-sm rounded-lg transition ${
                          selectedReport.status === "pending"
                            ? "bg-yellow-500 text-white"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        ⏳ Pending
                      </button>
                      <button
                        onClick={() => updateReportStatus(selectedReport.id, "in_progress")}
                        className={`px-3 py-1.5 text-sm rounded-lg transition ${
                          selectedReport.status === "in_progress"
                            ? "bg-blue-500 text-white"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        🔄 In Progress
                      </button>
                      <button
                        onClick={() => updateReportStatus(selectedReport.id, "resolved")}
                        className={`px-3 py-1.5 text-sm rounded-lg transition ${
                          selectedReport.status === "resolved"
                            ? "bg-green-500 text-white"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        ✅ Resolved
                      </button>
                      <button
                        onClick={() => updateReportStatus(selectedReport.id, "rejected")}
                        className={`px-3 py-1.5 text-sm rounded-lg transition ${
                          selectedReport.status === "rejected"
                            ? "bg-red-500 text-white"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        ❌ Reject
                      </button>
                    </div>
                  </div>

                  {/* Reply Section */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-gray-500">Reply to Customer</h4>
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Type your response here... The customer will receive this via email."
                      className="w-full p-3 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={4}
                    />
                    <button
                      onClick={sendReply}
                      disabled={sending || !replyText.trim()}
                      className="flex items-center justify-center gap-2 w-full py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:opacity-50 font-medium"
                    >
                      {sending ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          Send Reply
                        </>
                      )}
                    </button>
                    <p className="text-xs text-gray-400 text-center">
                      Customer will be notified via email immediately
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg p-8 shadow-sm border border-gray-200 flex items-center justify-center sticky top-4">
                <div className="text-center">
                  <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">Select a report to view details</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}