import { ImageResponse } from 'next/og'

export const dynamic = 'force-static'
export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
    return new ImageResponse(
        (
            <div
                style={{
                    fontSize: 18,
                    background: '#881337',
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#D4AF37',
                    borderRadius: '50%',
                    fontWeight: '900',
                }}
            >
                53
            </div>
        ),
        { ...size }
    )
}
