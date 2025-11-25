"use client";

import { useEffect, useRef, useState, memo } from 'react'; // ✅ Added memo
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface MapComponentProps {
  onLocationSelect: (lat: number, lng: number, address: string) => void;
  selectedLat: number | null;
  selectedLng: number | null;
}

// ✅ Changed from export default function to just function
function MapComponent({ onLocationSelect, selectedLat, selectedLng }: MapComponentProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);

  // Dumaguete City coordinates
  const DUMAguete_COORDS: [number, number] = [9.3103, 123.3081];
  const DUMAguete_ZOOM = 13;

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Ensure the container has proper dimensions
    if (mapRef.current.clientHeight === 0 || mapRef.current.clientWidth === 0) {
      console.warn('Map container has zero dimensions, setting default height');
      mapRef.current.style.height = '400px';
    }

    // Initialize map with a small delay to ensure DOM is ready
    const initMap = setTimeout(() => {
      try {
        // Set initial view to Dumaguete
        const map = L.map(mapRef.current!).setView(DUMAguete_COORDS, DUMAguete_ZOOM);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        // Force a map refresh/invalidation to fix positioning issues
        setTimeout(() => {
          map.invalidateSize();
        }, 100);

        mapInstanceRef.current = map;
        setIsMapReady(true);

        // Add click event to map
        map.on('click', async (e: L.LeafletMouseEvent) => {
          const { lat, lng } = e.latlng;
          
          // Remove existing marker
          if (markerRef.current) {
            map.removeLayer(markerRef.current);
          }

          // Add new marker with proper icon
          markerRef.current = L.marker([lat, lng]).addTo(map);
          
          // Try to get address from coordinates
          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
            );
            const data = await response.json();
            const address = data.display_name || 'Selected location';
            
            onLocationSelect(lat, lng, address);
          } catch (error) {
            console.error('Error getting address:', error);
            onLocationSelect(lat, lng, 'Selected location');
          }
        });

        // Add a marker at Dumaguete center on initial load
        const dumagueteMarker = L.marker(DUMAguete_COORDS)
          .addTo(map)
          .bindPopup('Dumaguete City Center')
          .openPopup();

        markerRef.current = dumagueteMarker;

        // Handle map resize events
        const handleResize = () => {
          setTimeout(() => {
            map.invalidateSize();
          }, 100);
        };

        window.addEventListener('resize', handleResize);

        // Cleanup
        return () => {
          window.removeEventListener('resize', handleResize);
          if (mapInstanceRef.current) {
            mapInstanceRef.current.remove();
            mapInstanceRef.current = null;
          }
        };

      } catch (error) {
        console.error('Error initializing map:', error);
      }
    }, 100);

    return () => {
      clearTimeout(initMap);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [onLocationSelect]);

  // Update marker when selected location changes
  useEffect(() => {
    if (mapInstanceRef.current && selectedLat !== null && selectedLng !== null && isMapReady) {
      // Remove existing marker
      if (markerRef.current) {
        mapInstanceRef.current.removeLayer(markerRef.current);
      }
      
      // Add marker at selected location
      markerRef.current = L.marker([selectedLat, selectedLng]).addTo(mapInstanceRef.current);
      
      // Set view to selected location
      mapInstanceRef.current.setView([selectedLat, selectedLng], 15);
      
      // Force refresh to fix _leaflet_pos issues
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 50);
    } else if (mapInstanceRef.current && selectedLat === null && selectedLng === null && isMapReady) {
      // If no location selected, return to Dumaguete view
      mapInstanceRef.current.setView(DUMAguete_COORDS, DUMAguete_ZOOM);
      
      // Remove any existing marker
      if (markerRef.current) {
        mapInstanceRef.current.removeLayer(markerRef.current);
        markerRef.current = null;
      }
    }
  }, [selectedLat, selectedLng, isMapReady]);

  // Additional effect to handle map container visibility changes
  useEffect(() => {
    if (mapInstanceRef.current && isMapReady) {
      const observer = new MutationObserver(() => {
        setTimeout(() => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.invalidateSize();
          }
        }, 100);
      });

      if (mapRef.current) {
        observer.observe(mapRef.current, {
          attributes: true,
          attributeFilter: ['style', 'class']
        });
      }

      return () => observer.disconnect();
    }
  }, [isMapReady]);

  // Function to reset to Dumaguete view
  const resetToDumaguete = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView(DUMAguete_COORDS, DUMAguete_ZOOM);
      
      // Remove existing marker
      if (markerRef.current) {
        mapInstanceRef.current.removeLayer(markerRef.current);
        markerRef.current = null;
      }
      
      onLocationSelect(DUMAguete_COORDS[0], DUMAguete_COORDS[1], 'Dumaguete City Center');
    }
  };

  return (
    <div className="relative w-full h-full">
      <div 
        ref={mapRef} 
        className="w-full h-full min-h-[400px]" 
        style={{ 
          height: '100%',
          minHeight: '400px',
        }} 
      />
      
      {/* Reset to Dumaguete button */}
      <button
        onClick={resetToDumaguete}
        className="absolute top-4 right-4 bg-blue-600 text-white px-3 py-2 rounded-lg shadow-lg hover:bg-blue-700 transition-colors z-[1000]"
        style={{ zIndex: 1000 }}
      >
        Reset to Dumaguete
      </button>
    </div>
  );
}

// ✅ ADD THIS: Export with memo to prevent unnecessary re-renders
export default memo(MapComponent, (prevProps, nextProps) => {
  // Only re-render if location props actually change
  return (
    prevProps.selectedLat === nextProps.selectedLat &&
    prevProps.selectedLng === nextProps.selectedLng
  );
});