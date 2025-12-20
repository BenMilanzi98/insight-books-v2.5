// app/api/placeholder/[width]/[height]/route.js
import { NextResponse } from 'next/server';

// Function to generate SVG placeholder with specified dimensions
export async function GET(request, { params }) {
  try {
    // Extract width and height from the URL parameters
    const width = parseInt(params.width) || 80;
    const height = parseInt(params.height) || 80;
    
    // Generate a random hex color for the background
    const bgColor = getRandomPastelColor();
    
    // Create an SVG placeholder
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <rect width="${width}" height="${height}" fill="${bgColor}" />
        <text 
          x="50%" 
          y="50%" 
          font-family="Arial, sans-serif" 
          font-size="${Math.max(14, Math.min(width, height) / 4)}px" 
          fill="#666" 
          text-anchor="middle" 
          dominant-baseline="middle"
        >
          ${width} × ${height}
        </text>
      </svg>
    `;
    
    // Return the SVG with appropriate headers
    return new NextResponse(svg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=31536000, immutable' // Cache for 1 year
      }
    });
  } catch (error) {
    console.error('Error generating placeholder:', error);
    
    // Return a fallback SVG on error
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
        <rect width="80" height="80" fill="#f0f0f0" />
        <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="12" fill="#999" text-anchor="middle" dominant-baseline="middle">Image</text>
      </svg>
    `;
    
    return new NextResponse(svg, {
      headers: {
        'Content-Type': 'image/svg+xml'
      }
    });
  }
}

// Function to generate a random pastel color
function getRandomPastelColor() {
  const hue = Math.floor(Math.random() * 360);
  return `hsl(${hue}, 70%, 80%)`;
}