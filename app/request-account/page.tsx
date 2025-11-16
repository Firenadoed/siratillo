"use client";

import { useState, useEffect } from "react";
import { Input } from "@/lib/ui/input";
import { Button } from "@/lib/ui/button";
import { Textarea } from "@/lib/ui/textarea";
import Image from "next/image";
import Link from "next/link";
import { Loader2, MapPin, AlertCircle, CheckCircle2 } from "lucide-react";
import dynamic from 'next/dynamic';
import { useRouter } from "next/navigation";

// Dynamically import map components with no SSR
const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false }
);

const TileLayer = dynamic(
  () => import('react-leaflet').then((mod) => mod.TileLayer),
  { ssr: false }
);

const Marker = dynamic(
  () => import('react-leaflet').then((mod) => mod.Marker),
  { ssr: false }
);

// Dynamically import the LocationMarker component
const LocationMarker = dynamic(
  () => Promise.resolve(({ onLocationSelect }: { onLocationSelect: (lat: number, lng: number, address: string) => void }) => {
    const { useMapEvents } = require('react-leaflet');
    const [position, setPosition] = useState<[number, number] | null>(null);

    useMapEvents({
      click(e: any) {
        const { lat, lng } = e.latlng;
        setPosition([lat, lng]);
        const address = `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`;
        onLocationSelect(lat, lng, address);
      },
    });

    return position === null ? null : <Marker position={position} />;
  }),
  { ssr: false }
);

// Default center coordinates
const DEFAULT_CENTER: [number, number] = [9.3103, 123.3081];

// Success Modal Component
function SuccessModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [countdown, setCountdown] = useState(3);
  const router = useRouter();

  useEffect(() => {
    if (isOpen) {
      setCountdown(3); // Reset countdown when modal opens
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(prev => prev - 1);
      }, 1000);

      return () => clearTimeout(timer);
    } else if (isOpen && countdown === 0) {
      // Use router.push instead of calling onClose to avoid state update during render
      router.push('/login');
    }
  }, [isOpen, countdown, router]);

  const handleClose = () => {
    router.push('/login');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center animate-in fade-in-90 zoom-in-90">
        <div className="flex justify-center mb-4">
          <div className="bg-green-100 p-3 rounded-full">
            <CheckCircle2 size={48} className="text-green-600" />
          </div>
        </div>
        
        <h2 className="text-2xl font-bold text-gray-800 mb-3">
          Request Sent Successfully!
        </h2>
        
        <p className="text-gray-600 mb-6">
          Your account request has been submitted. Our team will review your application and contact you within 24-48 hours.
        </p>
        
        <div className="flex items-center justify-center gap-2 text-sm text-blue-600 mb-4">
          <Loader2 size={16} className="animate-spin" />
          <span>Redirecting to login in {countdown} seconds...</span>
        </div>
        
        <Button 
          onClick={handleClose}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-all duration-200"
        >
          Go to Login Now
        </Button>
      </div>
    </div>
  );
}

export default function RequestAccountPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    contact: "",
    shopName: "",
    shopAddress: "",
    latitude: "",
    longitude: "",
    locationAddress: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState({
    name: "",
    email: "",
    contact: "",
    shopName: "",
    shopAddress: "",
    location: "",
  });
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const router = useRouter();

  // Fix Leaflet icons only in browser
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const L = require('leaflet');
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
      });
    }
  }, []);

  // Format phone number as user types
  const formatPhoneNumber = (value: string): string => {
    // Remove all non-digit characters except +
    const cleaned = value.replace(/[^\d+]/g, '');
    
    // Handle +63 format
    if (cleaned.startsWith('+63')) {
      const numbers = cleaned.slice(3);
      if (numbers.length <= 3) return `+63 ${numbers}`;
      if (numbers.length <= 6) return `+63 ${numbers.slice(0, 3)} ${numbers.slice(3)}`;
      return `+63 ${numbers.slice(0, 3)} ${numbers.slice(3, 6)} ${numbers.slice(6, 10)}`;
    }
    
    // Handle 09 format
    if (cleaned.startsWith('09')) {
      const numbers = cleaned.slice(2);
      if (numbers.length <= 3) return `09${numbers}`;
      if (numbers.length <= 6) return `09${numbers.slice(0, 3)} ${numbers.slice(3)}`;
      return `09${numbers.slice(0, 3)} ${numbers.slice(3, 6)} ${numbers.slice(6, 10)}`;
    }
    
    // Handle other cases
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 6) return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
    if (cleaned.length <= 10) return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 10)}`;
  };

  const validateForm = () => {
    const newErrors = {
      name: "",
      email: "",
      contact: "",
      shopName: "",
      shopAddress: "",
      location: "",
    };
    let isValid = true;

    // Name validation
    if (!formData.name.trim()) {
      newErrors.name = "Full name is required";
      isValid = false;
    } else if (formData.name.trim().length < 2) {
      newErrors.name = "Name must be at least 2 characters long";
      isValid = false;
    } else if (!/^[a-zA-Z\s.'-]+$/.test(formData.name.trim())) {
      newErrors.name = "Name can only contain letters, spaces, hyphens, and apostrophes";
      isValid = false;
    } else if (formData.name.trim().length > 50) {
      newErrors.name = "Name must be less than 50 characters";
      isValid = false;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email) {
      newErrors.email = "Email is required";
      isValid = false;
    } else if (!emailRegex.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
      isValid = false;
    } else if (formData.email.length > 100) {
      newErrors.email = "Email must be less than 100 characters";
      isValid = false;
    }

    // Contact number validation (Philippines format)
    const cleanContact = formData.contact.replace(/\s+/g, '');
    const contactRegex = /^(09|\+639)\d{9}$/;
    
    if (!formData.contact.trim()) {
      newErrors.contact = "Contact number is required";
      isValid = false;
    } else if (!contactRegex.test(cleanContact)) {
      newErrors.contact = "Please enter a valid Philippine mobile number (09XXX XXX XXXX or +63XXX XXX XXXX)";
      isValid = false;
    }

    // Shop name validation
    if (!formData.shopName.trim()) {
      newErrors.shopName = "Shop name is required";
      isValid = false;
    } else if (formData.shopName.trim().length < 2) {
      newErrors.shopName = "Shop name must be at least 2 characters long";
      isValid = false;
    } else if (formData.shopName.trim().length > 100) {
      newErrors.shopName = "Shop name must be less than 100 characters";
      isValid = false;
    }

    // Shop address validation
    if (!formData.shopAddress.trim()) {
      newErrors.shopAddress = "Shop address is required";
      isValid = false;
    } else if (formData.shopAddress.trim().length < 10) {
      newErrors.shopAddress = "Please provide a complete address (at least 10 characters)";
      isValid = false;
    } else if (formData.shopAddress.trim().length > 255) {
      newErrors.shopAddress = "Address must be less than 255 characters";
      isValid = false;
    }

    // Location validation
    if (!formData.latitude || !formData.longitude) {
      newErrors.location = "Please select your shop location on the map";
      isValid = false;
    } else {
      // Validate coordinates are valid numbers
      const lat = parseFloat(formData.latitude);
      const lng = parseFloat(formData.longitude);
      
      if (isNaN(lat) || isNaN(lng)) {
        newErrors.location = "Invalid coordinates selected";
        isValid = false;
      }
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleInputChange = (field: string, value: string) => {
    let processedValue = value;

    // Apply specific formatting/validation based on field type
    switch (field) {
      case 'contact':
        processedValue = formatPhoneNumber(value);
        // Limit length for formatted number
        if (processedValue.length > 17) return;
        break;
      case 'name':
        // Limit name length
        if (value.length > 50) return;
        break;
      case 'email':
        // Limit email length
        if (value.length > 100) return;
        break;
      case 'shopName':
        // Limit shop name length
        if (value.length > 100) return;
        break;
      case 'shopAddress':
        // Limit address length
        if (value.length > 255) return;
        break;
    }

    setFormData(prev => ({
      ...prev,
      [field]: processedValue
    }));

    // Clear error for this field when user starts typing
    if (errors[field as keyof typeof errors]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  const handleLocationSelect = (lat: number, lng: number, address: string) => {
    setFormData(prev => ({
      ...prev,
      latitude: lat.toString(),
      longitude: lng.toString(),
      locationAddress: address
    }));

    if (errors.location) {
      setErrors(prev => ({ ...prev, location: "" }));
    }
  };

  const handleSuccessModalClose = () => {
    setShowSuccessModal(false);
    router.push('/login');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent multiple submissions
    if (isSubmitting) return;

    if (!validateForm()) return;

    setIsSubmitting(true);
    setMessage("");

    try {
      const response = await fetch('/api/account-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          contact: formData.contact.replace(/\s+/g, '') // Remove spaces before sending
        }),
      });

      if (response.ok) {
        // Show success modal instead of inline message
        setShowSuccessModal(true);
        // Reset form
        setFormData({
          name: "",
          email: "",
          contact: "",
          shopName: "",
          shopAddress: "",
          latitude: "",
          longitude: "",
          locationAddress: "",
        });
      } else {
        const data = await response.json();
        setMessage(data.error || "Something went wrong. Please try again.");
      }
    } catch (error) {
      setMessage("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-blue-100 to-blue-200 px-4 relative overflow-hidden">
        {/* Wave Background Elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-blue-300/20 rounded-full blur-3xl"></div>
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-400/20 rounded-full blur-3xl"></div>
          <div className="absolute top-1/2 left-1/4 w-80 h-80 bg-blue-200/30 rounded-full blur-3xl"></div>
          <div className="absolute bottom-1/4 right-1/3 w-64 h-64 bg-blue-300/25 rounded-full blur-3xl"></div>
        </div>

        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl p-8 w-full max-w-4xl border border-white/20 relative z-10 my-8">
          <div className="flex justify-center mb-6">
            <Image 
              src="/logo.jpg" 
              alt="LaundryGo Logo" 
              width={100} 
              height={100} 
              className="rounded-full shadow-md" 
              priority
            />
          </div>

          <h1 className="text-3xl font-bold text-gray-800 mb-2 text-center">Join LaundryGo</h1>
          <p className="text-gray-600 text-center mb-8">Request a partner account for your laundry shop</p>

          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            <fieldset disabled={isSubmitting} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block mb-2 font-medium text-gray-700">Full Name *</label>
                  <Input 
                    placeholder="Enter your full name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    required
                    className="w-full"
                    maxLength={50}
                  />
                  {errors.name && (
                    <p className="text-red-500 text-xs mt-2 flex items-center gap-1">
                      <AlertCircle size={14} />
                      {errors.name}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block mb-2 font-medium text-gray-700">Business Email *</label>
                  <Input 
                    placeholder="owner@yourlaundry.com"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    required
                    className="w-full"
                    maxLength={100}
                  />
                  {errors.email && (
                    <p className="text-red-500 text-xs mt-2 flex items-center gap-1">
                      <AlertCircle size={14} />
                      {errors.email}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block mb-2 font-medium text-gray-700">Contact Number *</label>
                  <Input 
                    placeholder="09XX XXX XXXX or +63XX XXX XXXX"
                    value={formData.contact}
                    onChange={(e) => handleInputChange('contact', e.target.value)}
                    required
                    className="w-full"
                    maxLength={17}
                  />
                  {errors.contact && (
                    <p className="text-red-500 text-xs mt-2 flex items-center gap-1">
                      <AlertCircle size={14} />
                      {errors.contact}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block mb-2 font-medium text-gray-700">Shop Name *</label>
                  <Input 
                    placeholder="Enter your laundry shop name"
                    value={formData.shopName}
                    onChange={(e) => handleInputChange('shopName', e.target.value)}
                    required
                    className="w-full"
                    maxLength={100}
                  />
                  {errors.shopName && (
                    <p className="text-red-500 text-xs mt-2 flex items-center gap-1">
                      <AlertCircle size={14} />
                      {errors.shopName}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block mb-2 font-medium text-gray-700">Shop Complete Address *</label>
                <Textarea 
                  placeholder="Enter complete shop address (street, barangay, city)"
                  value={formData.shopAddress}
                  onChange={(e) => handleInputChange('shopAddress', e.target.value)}
                  required
                  rows={3}
                  className="w-full"
                  maxLength={255}
                />
                {errors.shopAddress && (
                  <p className="text-red-500 text-xs mt-2 flex items-center gap-1">
                    <AlertCircle size={14} />
                    {errors.shopAddress}
                  </p>
                )}
              </div>

              <div>
                <label className="block mb-2 font-medium text-gray-700">
                  Shop Location on Map *
                </label>
                <p className="text-sm text-gray-500 mb-3 flex items-center gap-2">
                  <MapPin size={16} />
                  Click on the map to mark your shop location
                </p>
                
                <div className="border border-gray-300 rounded-lg overflow-hidden">
                  <MapContainer
                    center={DEFAULT_CENTER}
                    zoom={13}
                    style={{ height: '300px', width: '100%' }}
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    />
                    <LocationMarker onLocationSelect={handleLocationSelect} />
                  </MapContainer>
                </div>

                {(formData.latitude && formData.longitude) && (
                  <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-md">
                    <p className="text-sm text-green-800">
                      <strong>Selected Location:</strong><br />
                      Latitude: {formData.latitude}<br />
                      Longitude: {formData.longitude}<br />
                      {formData.locationAddress && `Address: ${formData.locationAddress}`}
                    </p>
                  </div>
                )}

                {errors.location && (
                  <p className="text-red-500 text-xs mt-2 flex items-center gap-1">
                    <AlertCircle size={14} />
                    {errors.location}
                  </p>
                )}
              </div>

              <Button 
                type="submit" 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40" 
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Submitting Request...
                  </>
                ) : (
                  "Submit Account Request"
                )}
              </Button>
            </fieldset>

            {message && (
              <div className="p-4 rounded-md bg-red-50 text-red-800 border border-red-200">
                {message}
              </div>
            )}

            <div className="text-center pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                Already have an account?{" "}
                <Link 
                  href="/login" 
                  className="text-blue-600 hover:text-blue-500 font-medium underline"
                >
                  Sign in here
                </Link>
              </p>
            </div>
          </form>

          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">What happens next?</h3>
            <ul className="text-blue-800 space-y-1 text-sm">
              <li>• Submit your request using the form above</li>
              <li>• You'll receive a confirmation email immediately</li>
              <li>• Our team will review your application within 24-48 hours</li>
              <li>• We'll contact you for any additional information needed</li>
              <li>• Once approved, you'll get access to your partner dashboard</li>
            </ul>
          </div>
        </div>
      </div>

      <SuccessModal isOpen={showSuccessModal} onClose={handleSuccessModalClose} />
    </>
  );
}