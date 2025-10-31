// app/owner/qr-codes/page.tsx
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import DashboardLayout from "@/components/dashboard-layout"
import { useBranch } from "@/lib/branchcontext"
import { Toaster, toast } from "sonner"
import { 
  QrCode, 
  Download, 
  Copy, 
  RefreshCw, 
  MapPin,
  Building,
  Printer,
  Share2
} from "lucide-react"

interface QRCodeData {
  qr_code: string
  branch_id: string
  branch_name: string
  generated_at: string
}

function QRCodesContent() {
  const router = useRouter()
  const { selectedBranch, allBranches } = useBranch()
  const [qrCodes, setQrCodes] = useState<QRCodeData[]>([])
  const [loading, setLoading] = useState(false)
  const [generatingAll, setGeneratingAll] = useState(false)
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)

  // ==============================
  // 🔐 AUTHENTICATION CHECK FIRST
  // ==============================
  useEffect(() => {
    const checkAuth = async () => {
      try {
        console.log("🔄 Checking owner authentication for QR codes...")
        
        const response = await fetch('/api/owner/check-auth')
        const { authorized, error } = await response.json()
        
        if (!response.ok || !authorized) {
          toast.error(error || "Owner access required")
          router.replace("/login")
          return
        }
        
        console.log("✅ Owner authenticated for QR codes")
        setIsAuthorized(true)
        
      } catch (error) {
        console.error("Auth check error:", error)
        toast.error("Authentication failed")
        router.replace("/login")
      } finally {
        setAuthLoading(false)
      }
    }

    checkAuth()
  }, [router])

  // ==============================
  // 📱 FETCH QR CODES ONLY WHEN AUTHORIZED
  // ==============================
  useEffect(() => {
    if (!isAuthorized) return

    fetchQRCodes()
  }, [isAuthorized, allBranches])

  const fetchQRCodes = async () => {
    if (!allBranches.length) return

    setLoading(true)
    try {
      const codes: QRCodeData[] = []
      
      // Check for existing QR codes for each branch
      for (const branch of allBranches) {
        try {
          const response = await fetch('/api/owner/generate-qr', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include', // 👈 ADD THIS LINE
            body: JSON.stringify({ branch_id: branch.id }),
          })

          if (response.ok) {
            const data = await response.json()
            codes.push(data)
          } else {
            console.log(`No QR code found for ${branch.name}, will generate on demand`)
          }
        } catch (error) {
          console.error(`Failed to fetch QR for ${branch.name}:`, error)
        }
      }
      
      setQrCodes(codes)
    } catch (error) {
      console.error("Error fetching QR codes:", error)
      toast.error("Failed to load QR codes")
    } finally {
      setLoading(false)
    }
  }

  const generateQRCode = async (branchId: string, branchName: string) => {
    try {
      setLoading(true)
      toast.loading(`Generating QR code for ${branchName}...`)

      const response = await fetch('/api/owner/generate-qr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // 👈 ADD THIS LINE
        body: JSON.stringify({ branch_id: branchId }),
      })

      const data = await response.json()
      
      if (response.ok) {
        toast.dismiss()
        toast.success(`QR code for ${branchName} generated!`)
        
        // Update or add to qrCodes state
        setQrCodes(prev => {
          const filtered = prev.filter(qr => qr.branch_id !== branchId)
          return [...filtered, data]
        })
        
        return data
      } else {
        toast.dismiss()
        toast.error(data.error || `Failed to generate QR code for ${branchName}`)
        return null
      }
    } catch (error) {
      toast.dismiss()
      toast.error("Failed to generate QR code")
      console.error("QR generation error:", error)
      return null
    } finally {
      setLoading(false)
    }
  }

  const generateAllQRCodes = async () => {
    if (!allBranches.length) return

    setGeneratingAll(true)
    try {
      toast.loading("Generating QR codes for all branches...")
      
      const codes: QRCodeData[] = []
      
      for (const branch of allBranches) {
        const data = await generateQRCode(branch.id, branch.name)
        if (data) {
          codes.push(data)
        }
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500))
      }
      
      setQrCodes(codes)
      toast.dismiss()
      toast.success(`Generated ${codes.length} QR codes successfully!`)
    } catch (error) {
      toast.dismiss()
      toast.error("Failed to generate some QR codes")
    } finally {
      setGeneratingAll(false)
    }
  }

  const downloadQRCode = (qrCode: string, branchName: string) => {
    const link = document.createElement('a')
    link.href = qrCode
    link.download = `qr-code-${branchName.replace(/\s+/g, '-').toLowerCase()}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const copyQRCodeLink = async (qrCode: string) => {
    try {
      await navigator.clipboard.writeText(qrCode)
      toast.success("QR code image URL copied to clipboard!")
    } catch (error) {
      toast.error("Failed to copy QR code")
    }
  }

  const printQRCode = (qrCode: string, branchName: string) => {
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>QR Code - ${branchName}</title>
            <style>
              body { 
                font-family: Arial, sans-serif; 
                display: flex; 
                flex-direction: column; 
                align-items: center; 
                justify-content: center; 
                min-height: 100vh; 
                margin: 0; 
                padding: 40px;
                text-align: center;
              }
              h1 { 
                margin-bottom: 10px; 
                color: #1f2937;
                font-size: 24px;
              }
              p { 
                margin-bottom: 30px; 
                color: #6b7280;
                font-size: 16px;
              }
              img { 
                max-width: 400px; 
                height: auto; 
                border: 2px solid #e5e7eb;
                border-radius: 8px;
              }
              @media print {
                body { padding: 20px; }
                img { max-width: 300px; }
              }
            </style>
          </head>
          <body>
            <h1>${branchName}</h1>
            <p>Scan this QR code for laundry dropoff</p>
            <img src="${qrCode}" alt="QR Code for ${branchName}" />
            <script>
              window.onload = function() {
                window.print();
                setTimeout(() => window.close(), 1000);
              }
            </script>
          </body>
        </html>
      `)
      printWindow.document.close()
    }
  }

  const shareQRCode = async (qrCode: string, branchName: string) => {
    if (navigator.share) {
      try {
        // Convert data URL to blob for sharing
        const response = await fetch(qrCode)
        const blob = await response.blob()
        const file = new File([blob], `qr-code-${branchName}.png`, { type: 'image/png' })
        
        await navigator.share({
          title: `QR Code - ${branchName}`,
          text: `Scan this QR code for laundry dropoff at ${branchName}`,
          files: [file]
        })
      } catch (error) {
        console.error('Error sharing:', error)
        toast.error("Failed to share QR code")
      }
    } else {
      // Fallback: copy to clipboard and show message
      await copyQRCodeLink(qrCode)
    }
  }

  // ==============================
  // 🎯 LOADING AND AUTH STATES
  // ==============================
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Toaster position="top-right" richColors />
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Checking permissions...</p>
        </div>
      </div>
    )
  }

  if (!isAuthorized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-600">Redirecting to login...</p>
        </div>
      </div>
    )
  }

  if (loading && qrCodes.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading QR codes...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      
      <div className="p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
                  QR Codes
                </h1>
                <p className="text-gray-600 text-lg">
                  Generate and manage QR codes for customer dropoffs
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={generateAllQRCodes}
                  disabled={generatingAll || !allBranches.length}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl disabled:shadow-none"
                >
                  <RefreshCw className={`w-5 h-5 ${generatingAll ? 'animate-spin' : ''}`} />
                  {generatingAll ? 'Generating All...' : 'Generate All QR Codes'}
                </button>
                
                <button
                  onClick={fetchQRCodes}
                  disabled={loading}
                  className="flex items-center gap-2 px-6 py-3 bg-white hover:bg-gray-50 disabled:bg-gray-100 text-gray-700 font-semibold rounded-xl transition-all duration-200 border border-gray-200 shadow-sm hover:shadow disabled:shadow-none"
                >
                  <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-blue-200 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                  <Building className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Branches</p>
                  <p className="text-2xl font-bold text-gray-900">{allBranches.length}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-emerald-200 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <QrCode className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">QR Codes Generated</p>
                  <p className="text-2xl font-bold text-gray-900">{qrCodes.length}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-purple-200 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                  <MapPin className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Ready for Use</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {qrCodes.length}/{allBranches.length}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* QR Codes Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {allBranches.map((branch) => {
              const qrCode = qrCodes.find(qr => qr.branch_id === branch.id)
              const isGenerated = !!qrCode
              
              return (
                <div
                  key={branch.id}
                  className="bg-white/90 backdrop-blur-sm rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden"
                >
                  {/* Branch Header */}
                  <div className="p-6 border-b border-gray-100">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white shadow-lg">
                          <MapPin className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900 text-lg">
                            {branch.name}
                          </h3>
                          <p className="text-gray-600 text-sm line-clamp-2">
                            {branch.address}
                          </p>
                        </div>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                        isGenerated 
                          ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' 
                          : 'bg-amber-100 text-amber-700 border border-amber-200'
                      }`}>
                        {isGenerated ? 'Generated' : 'Not Generated'}
                      </div>
                    </div>
                  </div>

                  {/* QR Code Content */}
                  <div className="p-6">
                    {isGenerated ? (
                      <div className="space-y-4">
                        {/* QR Code Image */}
                        <div className="flex justify-center">
                          <img
                            src={qrCode.qr_code}
                            alt={`QR Code for ${branch.name}`}
                            className="w-48 h-48 border-4 border-white rounded-xl shadow-lg"
                          />
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => downloadQRCode(qrCode.qr_code, branch.name)}
                            className="flex items-center justify-center gap-2 p-3 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors duration-200 border border-blue-200"
                          >
                            <Download className="w-4 h-4" />
                            <span className="text-sm font-medium">Download</span>
                          </button>
                          
                          <button
                            onClick={() => printQRCode(qrCode.qr_code, branch.name)}
                            className="flex items-center justify-center gap-2 p-3 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg transition-colors duration-200 border border-gray-200"
                          >
                            <Printer className="w-4 h-4" />
                            <span className="text-sm font-medium">Print</span>
                          </button>
                          
                          <button
                            onClick={() => copyQRCodeLink(qrCode.qr_code)}
                            className="flex items-center justify-center gap-2 p-3 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg transition-colors duration-200 border border-purple-200"
                          >
                            <Copy className="w-4 h-4" />
                            <span className="text-sm font-medium">Copy</span>
                          </button>
                          
                          <button
                            onClick={() => shareQRCode(qrCode.qr_code, branch.name)}
                            className="flex items-center justify-center gap-2 p-3 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg transition-colors duration-200 border border-green-200"
                          >
                            <Share2 className="w-4 h-4" />
                            <span className="text-sm font-medium">Share</span>
                          </button>
                        </div>
                        
                        {/* Generated Info */}
                        <div className="text-center">
                          <p className="text-xs text-gray-500">
                            Generated: {new Date(qrCode.generated_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <QrCode className="w-8 h-8 text-gray-400" />
                        </div>
                        <p className="text-gray-500 mb-4">No QR code generated yet</p>
                        <button
                          onClick={() => generateQRCode(branch.id, branch.name)}
                          disabled={loading}
                          className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-xl transition-all duration-200 mx-auto"
                        >
                          <QrCode className="w-4 h-4" />
                          {loading ? 'Generating...' : 'Generate QR Code'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Empty State */}
          {allBranches.length === 0 && (
            <div className="text-center py-16">
              <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Building className="w-12 h-12 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                No Branches Found
              </h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                You need to create branches first before you can generate QR codes for them.
              </p>
              <button
                onClick={() => router.push('/owner')}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors duration-200"
              >
                Go to Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Main export that wraps with DashboardLayout
export default function QRCodesPage() {
  return (
    <DashboardLayout>
      <QRCodesContent />
    </DashboardLayout>
  )
}