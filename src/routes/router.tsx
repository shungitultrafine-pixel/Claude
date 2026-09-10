import { createBrowserRouter } from 'react-router'
import { SiteLayout } from '../layouts/SiteLayout'
import { HomePage } from '../pages/HomePage'
import { SectionPage } from '../pages/SectionPage'

export const router = createBrowserRouter([
  {
    element: <SiteLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'concept', element: <SectionPage title="Concept" /> },
      { path: 'applications', element: <SectionPage title="Applications" /> },
      { path: 'water', element: <SectionPage title="Water" /> },
      { path: 'science-evidence', element: <SectionPage title="Science & Evidence" /> },
      { path: 'technology', element: <SectionPage title="Technology" /> },
      { path: 'milling-systems', element: <SectionPage title="Milling Systems" /> },
      { path: 'company', element: <SectionPage title="Company" /> },
      { path: 'contact', element: <SectionPage title="Contact" /> },
    ],
  },
])
