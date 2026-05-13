// app/api/owner/reports/reply/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { verifyOwnerAccess } from '@/lib/owner-auth'
import { sendEmailNodemailer } from '@/lib/nodemailer'

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyOwnerAccess()
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status || 401 })
    }

    const { reportId, message } = await request.json()

    if (!reportId || !message) {
      return NextResponse.json({ error: 'Report ID and message required' }, { status: 400 })
    }

    // Get report details
    const { data: report, error: reportError } = await supabaseAdmin
      .from('issue_reports')
      .select('customer_email, customer_name, status')
      .eq('id', reportId)
      .single()

    if (reportError || !report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    // Update report status to in_progress if it was pending
    await supabaseAdmin
      .from('issue_reports')
      .update({ 
        status: report.status === 'pending' ? 'in_progress' : report.status,
        updated_at: new Date().toISOString()
      })
      .eq('id', reportId)

    // Send email notification to customer
    if (report.customer_email) {
      try {
        await sendEmailNodemailer({
          to: report.customer_email,
          subject: `Response to your report #${reportId.slice(-6)}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #0AADFF 0%, #0088CC 100%); padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 24px;">LaundryGo</h1>
                <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0;">Issue Report Update</p>
              </div>
              
              <div style="background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
                <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
                  Hello <strong>${report.customer_name || 'Customer'}</strong>,
                </p>
                
                <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
                  You have received a response regarding your issue report:
                </p>
                
                <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0AADFF;">
                  <p style="margin: 0; color: #555; line-height: 1.6;">${message.replace(/\n/g, '<br/>')}</p>
                </div>
                
                <p style="font-size: 14px; color: #666; margin-top: 20px;">
                  <strong>Report ID:</strong> #${reportId.slice(-6)}<br/>
                  <strong>Status:</strong> ${report.status === 'pending' ? 'In Progress' : report.status}
                </p>
                
                <hr style="margin: 30px 0 20px; border: none; border-top: 1px solid #eee;">
                
                <p style="font-size: 12px; color: #999; text-align: center;">
                  This is an automated message from LaundryGo. Please do not reply directly to this email.<br/>
                  If you need further assistance, please contact us at support@laundrygo.com
                </p>
              </div>
            </div>
          `
        });
        console.log(`Email sent to ${report.customer_email} for report ${reportId}`);
      } catch (emailError) {
        console.error('Failed to send email:', emailError);
        // Don't fail the request if email fails
      }
    }

    // Audit log
    try {
      await supabaseAdmin
        .from('admin_audit_logs')
        .insert({
          admin_id: auth.userId,
          action: 'reply_to_report',
          description: `Replied to report ${reportId} and sent email to customer`,
          ip_address: request.headers.get('x-forwarded-for') || 'unknown',
          user_agent: request.headers.get('user-agent') || 'unknown',
          created_at: new Date().toISOString()
        });
    } catch (auditError) {
      console.error('Failed to create audit log:', auditError);
    }

    return NextResponse.json({ success: true }, { status: 200 });
    
  } catch (error) {
    console.error('Error sending reply:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}