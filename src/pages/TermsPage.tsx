import { useNavigate } from 'react-router-dom'

const SECTIONS = [
  {
    num: '1.',
    title: 'Acceptance of Terms',
    body: 'By registering for or using VesselRFQ ("the Service"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service. These terms apply to all users including buyers, fabricators, and visitors.',
  },
  {
    num: '2.',
    title: 'Description of Service',
    body: 'VesselRFQ provides an online platform that allows industrial buyers to configure and submit pressure vessel RFQs, and allows ASME Code fabricators to receive and manage those RFQs through a dashboard and embeddable website configurator.',
  },
  {
    num: '3.',
    title: 'Accounts',
    body: 'You are responsible for maintaining the confidentiality of your account credentials. You agree to provide accurate information when registering. VesselRFQ reserves the right to suspend or terminate accounts that violate these terms or are used fraudulently.',
  },
  {
    num: '4.',
    title: 'Fabricator Subscriptions',
    body: 'Fabricator accounts are billed monthly at the rate displayed at the time of registration. Subscriptions renew automatically until cancelled. You may cancel at any time and your access will continue through the end of the current billing period. No refunds are issued for partial months. VesselRFQ reserves the right to change pricing with 30 days written notice.',
  },
  {
    num: '5.',
    title: 'RFQ Data and Ownership',
    body: 'Buyers retain ownership of the vessel specifications and project information they submit. Fabricators retain ownership of the quote and pricing information they enter into the dashboard. VesselRFQ does not sell, share, or use RFQ data for any purpose other than operating the Service. RFQ data submitted through a fabricator\'s embedded configurator is visible only to that fabricator and the buyer who submitted it.',
  },
  {
    num: '6.',
    title: 'No Guarantee of Business',
    body: 'VesselRFQ is a technology platform. We do not guarantee that buyers will receive quotes, that fabricators will receive RFQs, or that any transaction will result from use of the Service. VesselRFQ is not a party to any agreement between buyers and fabricators.',
  },
  {
    num: '7.',
    title: 'Fabricator Responsibilities',
    body: 'Fabricators are solely responsible for all aspects of vessel fabrication including but not limited to the accuracy of quotes, compliance with ASME Code requirements, filing of required documentation, passing all required inspections, and holding all certifications required by applicable jurisdictions. VesselRFQ is a technology platform only and assumes no engineering, professional, or fabrication liability of any kind.',
  },
  {
    num: '8.',
    title: 'Buyer Responsibilities',
    body: 'Buyers are responsible for the accuracy of the vessel specifications they submit. Fabricators rely on submitted specifications to prepare estimates. VesselRFQ is not liable for errors in specifications submitted by buyers.',
  },
  {
    num: '9.',
    title: 'Intellectual Property',
    body: 'The VesselRFQ platform, including the vessel configurator, dashboard, and all software, is the intellectual property of VesselRFQ. You may not copy, reverse engineer, or redistribute any part of the platform. The embed snippet provided to fabricators may be used solely for the purpose of embedding the configurator on the fabricator\'s own website.',
  },
  {
    num: '10.',
    title: 'Limitation of Liability',
    body: 'VesselRFQ is provided "as is." To the maximum extent permitted by law, VesselRFQ and its owners are not liable for any indirect, incidental, or consequential damages arising from use of the Service, including but not limited to lost revenue, lost data, or business interruption. Our total liability to you for any claim arising from use of the Service shall not exceed the amount you paid to VesselRFQ in the three months preceding the claim.',
  },
  {
    num: '11.',
    title: 'Indemnification',
    body: 'You agree to indemnify and hold harmless VesselRFQ and its owners from any claims, damages, or expenses arising from your use of the Service, your violation of these terms, or your violation of any third party\'s rights.',
  },
  {
    num: '12.',
    title: 'Termination',
    body: 'VesselRFQ may suspend or terminate your account at any time for violation of these terms, non-payment, or at our discretion with reasonable notice. Upon termination, your access to the Service ends and your data may be deleted after 90 days.',
  },
  {
    num: '13.',
    title: 'Governing Law',
    body: 'These terms are governed by the laws of the State of Wyoming. Any disputes shall be resolved in the courts of Wyoming.',
  },
  {
    num: '14.',
    title: 'Changes to Terms',
    body: 'VesselRFQ reserves the right to update these terms at any time. We will notify registered users by email at least 14 days before material changes take effect. Continued use of the Service after that date constitutes acceptance of the new terms.',
  },
  {
    num: '15.',
    title: 'Contact',
    body: null,
    contact: true,
  },
]

export default function TermsPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-12">

        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors mb-10"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </button>

        <div className="mb-10 pb-8 border-b border-slate-200">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Terms of Service</h1>
          <p className="text-sm text-slate-500">Last updated: April 1, 2026</p>
        </div>

        <div className="space-y-8">
          {SECTIONS.map((s) => (
            <section key={s.num}>
              <h2 className="text-base font-semibold text-slate-900 mb-2">
                {s.num} {s.title}
              </h2>
              {s.contact ? (
                <p className="text-sm text-slate-600 leading-relaxed">
                  For questions about these terms, contact us at{' '}
                  <a href="mailto:rfqs@vesselrfq.com" className="text-blue-600 hover:text-blue-700">
                    rfqs@vesselrfq.com
                  </a>
                  .
                </p>
              ) : (
                <p className="text-sm text-slate-600 leading-relaxed">{s.body}</p>
              )}
            </section>
          ))}
        </div>

      </div>
    </div>
  )
}
