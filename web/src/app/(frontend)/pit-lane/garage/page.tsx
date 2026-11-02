import { translatedMetadata } from '@/lib/i18n/server'
import Garage from '@/components/PitLane/Garage'

export async function generateMetadata() { return translatedMetadata({ title: "@i18n:garage.title@", description: "@i18n:garage.lede@", robots: { index: false, follow: false } }) }

export default function GaragePage() { return <Garage/> }
