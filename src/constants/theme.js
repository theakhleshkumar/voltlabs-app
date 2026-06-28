/**
 * VoltLabs brand theme
 * Shared colors so the app's look matches the VoltLabs logo/brand consistently.
 */

// Inter font family (bundled in android/app/src/main/assets/fonts).
// On Android, custom fonts need a separate fontFamily per weight -
// `fontWeight` is ignored, so use these instead of fontWeight: '600'/'bold' etc.
export const fonts = {
  regular: 'Inter-Regular',   // fontWeight 400 / normal
  medium: 'Inter-Medium',     // fontWeight 500
  semiBold: 'Inter-SemiBold', // fontWeight 600
  bold: 'Inter-Bold',         // fontWeight 700 / bold
};

export const colors = {
  // Brand
  primary: '#FFC107',   // VoltLabs amber - primary buttons, active states, accents
  primarySoft: '#FFF8E1', // soft amber tint - highlights behind active/selected items
  dark: '#1A1A1A',      // near-black - primary text, and text/icons on top of `primary`

  // Text
  textSecondary: '#374151',    // headings/values within cards
  textMuted: '#6B7280',        // secondary labels
  textPlaceholder: '#9CA3AF',  // inactive icons, placeholders, disabled text

  // Surfaces & borders
  background: '#FFFFFF',
  surface: '#F9FAFB',          // light card/input backgrounds
  surfaceAlt: '#F3F4F6',        // alt light backgrounds (e.g. segmented buttons)
  border: '#E5E7EB',
  disabled: '#E5E7EB',
  iconDisabled: '#D1D5DB',     // icons in a disabled/offline state

  // Status
  success: '#22C55E',
  error: '#DC2626',
};
