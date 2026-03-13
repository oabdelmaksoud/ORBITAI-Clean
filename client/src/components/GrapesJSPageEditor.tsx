import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Save, Eye, RefreshCw, Download, Upload, Loader2, AlertCircle, CheckCircle, Undo2, Redo2, Code, Maximize2, Minimize2, Copy, Trash2, Plus, FileText, ChevronDown, Settings, Layers, Palette, Monitor, Tablet, Smartphone } from 'lucide-react';
import grapesjs, { Editor } from 'grapesjs';
import 'grapesjs/dist/css/grapes.min.css';
// GrapesJS Plugins
import gjsPresetWebpage from 'grapesjs-preset-webpage';
import gjsBlocksBasic from 'grapesjs-blocks-basic';
import gjsForms from 'grapesjs-plugin-forms';
import gjsExport from 'grapesjs-plugin-export';
import gjsTabs from 'grapesjs-tabs';
import gjsTooltip from 'grapesjs-tooltip';
import gjsTouch from 'grapesjs-touch';
import { showAlert } from '../utils/browserUtils';
import {
  getPageContent,
  savePageSection,
  updatePageSection,
  PageContent,
  PageSection
} from '../services/pageContentApi';

// Page interface for multi-page support
export interface GrapesPage {
  id: string;
  name: string;
  slug: string;
  html: string;
  css: string;
  createdAt: Date;
  updatedAt: Date;
}

interface GrapesJSPageEditorProps {
  token: string;
  pageKey?: string;
  pages?: GrapesPage[];
  onSave?: (pageData: { html: string; css: string; pageKey: string }) => void;
  onPageChange?: (pageKey: string) => void;
  onCreatePage?: (name: string) => Promise<GrapesPage>;
  onDeletePage?: (pageKey: string) => Promise<void>;
}

/**
 * GrapesJS Page Editor Component
 * Fully integrated visual drag-and-drop page builder with comprehensive blocks and features
 */
export const GrapesJSPageEditor: React.FC<GrapesJSPageEditorProps> = ({
  token,
  pageKey = 'home',
  pages = [],
  onSave,
  onPageChange,
  onCreatePage,
  onDeletePage,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const grapesEditorRef = useRef<Editor | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [codeContent, setCodeContent] = useState({ html: '', css: '' });
  const [currentPageKey, setCurrentPageKey] = useState(pageKey);
  const [showPageMenu, setShowPageMenu] = useState(false);
  const [showNewPageModal, setShowNewPageModal] = useState(false);
  const [newPageName, setNewPageName] = useState('');
  const [activeDevice, setActiveDevice] = useState<'Desktop' | 'Tablet' | 'Mobile'>('Desktop');
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Comprehensive blocks library
  const getBlocks = () => [
    // Layout Blocks
    {
      id: 'section',
      label: '<b>Section</b>',
      category: 'Layout',
      content: '<section class="gjs-section" style="padding: 3rem 0; min-height: 200px; background: #ffffff;"><div class="gjs-container" style="max-width: 1200px; margin: 0 auto; padding: 0 1rem;"></div></section>',
      attributes: { class: 'gjs-section' },
    },
    {
      id: 'container',
      label: 'Container',
      category: 'Layout',
      content: '<div class="gjs-container" style="max-width: 1200px; margin: 0 auto; padding: 0 1rem;"></div>',
    },
    {
      id: 'row',
      label: 'Row (Flex)',
      category: 'Layout',
      content: '<div class="gjs-row" style="display: flex; gap: 1rem; padding: 1rem; flex-wrap: wrap;"></div>',
    },
    {
      id: 'column',
      label: 'Column',
      category: 'Layout',
      content: '<div class="gjs-column" style="flex: 1; padding: 1rem; min-width: 200px;"></div>',
    },
    {
      id: 'grid-2',
      label: '2 Column Grid',
      category: 'Layout',
      content: '<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5rem; padding: 1rem;"><div style="padding: 1rem; background: #f8fafc; border-radius: 0.5rem;">Column 1</div><div style="padding: 1rem; background: #f8fafc; border-radius: 0.5rem;">Column 2</div></div>',
    },
    {
      id: 'grid-3',
      label: '3 Column Grid',
      category: 'Layout',
      content: '<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; padding: 1rem;"><div style="padding: 1rem; background: #f8fafc; border-radius: 0.5rem;">Column 1</div><div style="padding: 1rem; background: #f8fafc; border-radius: 0.5rem;">Column 2</div><div style="padding: 1rem; background: #f8fafc; border-radius: 0.5rem;">Column 3</div></div>',
    },
    {
      id: 'grid-4',
      label: '4 Column Grid',
      category: 'Layout',
      content: '<div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; padding: 1rem;"><div style="padding: 1rem; background: #f8fafc; border-radius: 0.5rem;">1</div><div style="padding: 1rem; background: #f8fafc; border-radius: 0.5rem;">2</div><div style="padding: 1rem; background: #f8fafc; border-radius: 0.5rem;">3</div><div style="padding: 1rem; background: #f8fafc; border-radius: 0.5rem;">4</div></div>',
    },
    
    // Typography Blocks
    {
      id: 'heading-h1',
      label: 'Heading H1',
      category: 'Typography',
      content: '<h1 style="font-size: 3rem; font-weight: 700; margin: 1rem 0; line-height: 1.2;">Main Heading</h1>',
    },
    {
      id: 'heading-h2',
      label: 'Heading H2',
      category: 'Typography',
      content: '<h2 style="font-size: 2.25rem; font-weight: 600; margin: 1rem 0; line-height: 1.3;">Section Heading</h2>',
    },
    {
      id: 'heading-h3',
      label: 'Heading H3',
      category: 'Typography',
      content: '<h3 style="font-size: 1.875rem; font-weight: 600; margin: 1rem 0; line-height: 1.4;">Subsection Heading</h3>',
    },
    {
      id: 'paragraph',
      label: 'Paragraph',
      category: 'Typography',
      content: '<p style="margin: 1rem 0; line-height: 1.6; color: #475569;">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>',
    },
    {
      id: 'quote',
      label: 'Quote',
      category: 'Typography',
      content: '<blockquote style="border-left: 4px solid #3b82f6; padding-left: 1.5rem; margin: 1.5rem 0; font-style: italic; color: #64748b;">"The best way to predict the future is to create it."</blockquote>',
    },
    
    // Basic Components
    {
      id: 'text',
      label: 'Text',
      category: 'Basic',
      content: '<div style="padding: 1rem;">Insert your text here</div>',
    },
    {
      id: 'image',
      label: 'Image',
      category: 'Basic',
      content: {
        type: 'image',
        src: 'https://via.placeholder.com/800x400/3b82f6/ffffff?text=Image',
        style: { width: '100%', display: 'block', borderRadius: '0.5rem' },
      },
    },
    {
      id: 'link',
      label: 'Link',
      category: 'Basic',
      content: {
        type: 'link',
        content: 'Click here',
        href: '#',
        style: { color: '#3b82f6', textDecoration: 'underline', fontSize: '1rem' },
      },
    },
    {
      id: 'button',
      label: 'Button',
      category: 'Basic',
      content: {
        type: 'button',
        content: 'Click me',
        style: {
          padding: '0.75rem 1.5rem',
          backgroundColor: '#3b82f6',
          color: 'white',
          borderRadius: '0.5rem',
          border: 'none',
          cursor: 'pointer',
          fontSize: '1rem',
          fontWeight: '500',
          display: 'inline-block',
        },
      },
    },
    {
      id: 'button-secondary',
      label: 'Button Secondary',
      category: 'Basic',
      content: {
        type: 'button',
        content: 'Secondary Button',
        style: {
          padding: '0.75rem 1.5rem',
          backgroundColor: 'transparent',
          color: '#3b82f6',
          borderRadius: '0.5rem',
          border: '2px solid #3b82f6',
          cursor: 'pointer',
          fontSize: '1rem',
          fontWeight: '500',
          display: 'inline-block',
        },
      },
    },
    
    // Hero Sections
    {
      id: 'hero-basic',
      label: 'Hero Section',
      category: 'Sections',
      content: `
        <section style="padding: 5rem 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-align: center;">
          <div style="max-width: 800px; margin: 0 auto; padding: 0 1rem;">
            <h1 style="font-size: 3.5rem; font-weight: 700; margin-bottom: 1.5rem; line-height: 1.2;">Welcome to Our Platform</h1>
            <p style="font-size: 1.25rem; margin-bottom: 2rem; opacity: 0.9; line-height: 1.6;">Build amazing experiences with our powerful tools</p>
            <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
              <button style="padding: 0.875rem 2rem; background: white; color: #667eea; border: none; border-radius: 0.5rem; font-size: 1rem; font-weight: 600; cursor: pointer;">Get Started</button>
              <button style="padding: 0.875rem 2rem; background: transparent; color: white; border: 2px solid white; border-radius: 0.5rem; font-size: 1rem; font-weight: 600; cursor: pointer;">Learn More</button>
            </div>
          </div>
        </section>
      `,
    },
    {
      id: 'hero-image',
      label: 'Hero with Image',
      category: 'Sections',
      content: `
        <section style="padding: 4rem 0; background: #f8fafc;">
          <div style="max-width: 1200px; margin: 0 auto; padding: 0 1rem; display: grid; grid-template-columns: 1fr 1fr; gap: 3rem; align-items: center;">
            <div>
              <h1 style="font-size: 3rem; font-weight: 700; margin-bottom: 1.5rem; line-height: 1.2; color: #0f172a;">Build Something Amazing</h1>
              <p style="font-size: 1.125rem; margin-bottom: 2rem; color: #64748b; line-height: 1.6;">Create beautiful pages with our drag-and-drop editor</p>
              <button style="padding: 0.875rem 2rem; background: #3b82f6; color: white; border: none; border-radius: 0.5rem; font-size: 1rem; font-weight: 600; cursor: pointer;">Get Started</button>
            </div>
            <div>
              <img src="https://via.placeholder.com/600x400/3b82f6/ffffff?text=Hero+Image" style="width: 100%; border-radius: 0.75rem; box-shadow: 0 10px 25px rgba(0,0,0,0.1);" />
            </div>
          </div>
        </section>
      `,
    },
    
    // Features Section
    {
      id: 'features-grid',
      label: 'Features Grid',
      category: 'Sections',
      content: `
        <section style="padding: 4rem 0; background: white;">
          <div style="max-width: 1200px; margin: 0 auto; padding: 0 1rem;">
            <div style="text-align: center; margin-bottom: 3rem;">
              <h2 style="font-size: 2.5rem; font-weight: 700; margin-bottom: 1rem; color: #0f172a;">Our Features</h2>
              <p style="font-size: 1.125rem; color: #64748b; max-width: 600px; margin: 0 auto;">Everything you need to build amazing products</p>
            </div>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 2rem;">
              <div style="padding: 2rem; background: #f8fafc; border-radius: 0.75rem; text-align: center;">
                <div style="width: 64px; height: 64px; background: #3b82f6; border-radius: 50%; margin: 0 auto 1.5rem; display: flex; align-items: center; justify-content: center; font-size: 2rem;">⚡</div>
                <h3 style="font-size: 1.5rem; font-weight: 600; margin-bottom: 0.75rem; color: #0f172a;">Fast Performance</h3>
                <p style="color: #64748b; line-height: 1.6;">Lightning-fast loading times and optimized performance</p>
              </div>
              <div style="padding: 2rem; background: #f8fafc; border-radius: 0.75rem; text-align: center;">
                <div style="width: 64px; height: 64px; background: #10b981; border-radius: 50%; margin: 0 auto 1.5rem; display: flex; align-items: center; justify-content: center; font-size: 2rem;">🔒</div>
                <h3 style="font-size: 1.5rem; font-weight: 600; margin-bottom: 0.75rem; color: #0f172a;">Secure</h3>
                <p style="color: #64748b; line-height: 1.6;">Enterprise-grade security and data protection</p>
              </div>
              <div style="padding: 2rem; background: #f8fafc; border-radius: 0.75rem; text-align: center;">
                <div style="width: 64px; height: 64px; background: #f59e0b; border-radius: 50%; margin: 0 auto 1.5rem; display: flex; align-items: center; justify-content: center; font-size: 2rem;">🎨</div>
                <h3 style="font-size: 1.5rem; font-weight: 600; margin-bottom: 0.75rem; color: #0f172a;">Customizable</h3>
                <p style="color: #64748b; line-height: 1.6;">Fully customizable to match your brand</p>
              </div>
            </div>
          </div>
        </section>
      `,
    },
    
    // Testimonials
    {
      id: 'testimonials',
      label: 'Testimonials',
      category: 'Sections',
      content: `
        <section style="padding: 4rem 0; background: #f8fafc;">
          <div style="max-width: 1200px; margin: 0 auto; padding: 0 1rem;">
            <div style="text-align: center; margin-bottom: 3rem;">
              <h2 style="font-size: 2.5rem; font-weight: 700; margin-bottom: 1rem; color: #0f172a;">What Our Users Say</h2>
            </div>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 2rem;">
              <div style="padding: 2rem; background: white; border-radius: 0.75rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <div style="margin-bottom: 1rem; color: #fbbf24;">★★★★★</div>
                <p style="color: #475569; margin-bottom: 1.5rem; line-height: 1.6; font-style: italic;">"This platform has transformed how we work. Highly recommended!"</p>
                <div style="display: flex; align-items: center; gap: 1rem;">
                  <div style="width: 48px; height: 48px; background: #3b82f6; border-radius: 50%;"></div>
                  <div>
                    <div style="font-weight: 600; color: #0f172a;">John Doe</div>
                    <div style="font-size: 0.875rem; color: #64748b;">CEO, Company</div>
                  </div>
                </div>
              </div>
              <div style="padding: 2rem; background: white; border-radius: 0.75rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <div style="margin-bottom: 1rem; color: #fbbf24;">★★★★★</div>
                <p style="color: #475569; margin-bottom: 1.5rem; line-height: 1.6; font-style: italic;">"Amazing features and excellent support. Couldn't be happier!"</p>
                <div style="display: flex; align-items: center; gap: 1rem;">
                  <div style="width: 48px; height: 48px; background: #10b981; border-radius: 50%;"></div>
                  <div>
                    <div style="font-weight: 600; color: #0f172a;">Jane Smith</div>
                    <div style="font-size: 0.875rem; color: #64748b;">Designer, Studio</div>
                  </div>
                </div>
              </div>
              <div style="padding: 2rem; background: white; border-radius: 0.75rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <div style="margin-bottom: 1rem; color: #fbbf24;">★★★★★</div>
                <p style="color: #475569; margin-bottom: 1.5rem; line-height: 1.6; font-style: italic;">"The best investment we've made. ROI is incredible!"</p>
                <div style="display: flex; align-items: center; gap: 1rem;">
                  <div style="width: 48px; height: 48px; background: #f59e0b; border-radius: 50%;"></div>
                  <div>
                    <div style="font-weight: 600; color: #0f172a;">Mike Johnson</div>
                    <div style="font-size: 0.875rem; color: #64748b;">Founder, Startup</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      `,
    },
    
    // FAQ Section
    {
      id: 'faq',
      label: 'FAQ Section',
      category: 'Sections',
      content: `
        <section style="padding: 4rem 0; background: white;">
          <div style="max-width: 800px; margin: 0 auto; padding: 0 1rem;">
            <div style="text-align: center; margin-bottom: 3rem;">
              <h2 style="font-size: 2.5rem; font-weight: 700; margin-bottom: 1rem; color: #0f172a;">Frequently Asked Questions</h2>
            </div>
            <div style="display: flex; flex-direction: column; gap: 1rem;">
              <div style="padding: 1.5rem; background: #f8fafc; border-radius: 0.5rem;">
                <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.75rem; color: #0f172a;">What is this platform?</h3>
                <p style="color: #64748b; line-height: 1.6;">This is a powerful page builder that allows you to create beautiful websites without coding.</p>
              </div>
              <div style="padding: 1.5rem; background: #f8fafc; border-radius: 0.5rem;">
                <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.75rem; color: #0f172a;">How do I get started?</h3>
                <p style="color: #64748b; line-height: 1.6;">Simply sign up for an account and start building your pages using our drag-and-drop editor.</p>
              </div>
              <div style="padding: 1.5rem; background: #f8fafc; border-radius: 0.5rem;">
                <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.75rem; color: #0f172a;">Is there a free trial?</h3>
                <p style="color: #64748b; line-height: 1.6;">Yes, we offer a 14-day free trial with full access to all features.</p>
              </div>
            </div>
          </div>
        </section>
      `,
    },
    
    // Pricing Section
    {
      id: 'pricing',
      label: 'Pricing Cards',
      category: 'Sections',
      content: `
        <section style="padding: 4rem 0; background: #f8fafc;">
          <div style="max-width: 1200px; margin: 0 auto; padding: 0 1rem;">
            <div style="text-align: center; margin-bottom: 3rem;">
              <h2 style="font-size: 2.5rem; font-weight: 700; margin-bottom: 1rem; color: #0f172a;">Choose Your Plan</h2>
              <p style="font-size: 1.125rem; color: #64748b;">Select the perfect plan for your needs</p>
            </div>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 2rem;">
              <div style="padding: 2.5rem; background: white; border-radius: 0.75rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <h3 style="font-size: 1.5rem; font-weight: 600; margin-bottom: 0.5rem; color: #0f172a;">Basic</h3>
                <div style="font-size: 3rem; font-weight: 700; color: #0f172a; margin-bottom: 1rem;">$29<span style="font-size: 1rem; color: #64748b;">/mo</span></div>
                <ul style="list-style: none; padding: 0; margin-bottom: 2rem;">
                  <li style="padding: 0.5rem 0; color: #475569;">✓ Feature 1</li>
                  <li style="padding: 0.5rem 0; color: #475569;">✓ Feature 2</li>
                  <li style="padding: 0.5rem 0; color: #475569;">✓ Feature 3</li>
                </ul>
                <button style="width: 100%; padding: 0.875rem; background: #3b82f6; color: white; border: none; border-radius: 0.5rem; font-weight: 600; cursor: pointer;">Get Started</button>
              </div>
              <div style="padding: 2.5rem; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; border-radius: 0.75rem; box-shadow: 0 10px 25px rgba(59,130,246,0.3); transform: scale(1.05);">
                <div style="text-align: center; margin-bottom: 0.5rem;"><span style="background: rgba(255,255,255,0.2); padding: 0.25rem 0.75rem; border-radius: 1rem; font-size: 0.875rem; font-weight: 600;">POPULAR</span></div>
                <h3 style="font-size: 1.5rem; font-weight: 600; margin-bottom: 0.5rem;">Pro</h3>
                <div style="font-size: 3rem; font-weight: 700; margin-bottom: 1rem;">$79<span style="font-size: 1rem; opacity: 0.8;">/mo</span></div>
                <ul style="list-style: none; padding: 0; margin-bottom: 2rem;">
                  <li style="padding: 0.5rem 0; opacity: 0.9;">✓ All Basic Features</li>
                  <li style="padding: 0.5rem 0; opacity: 0.9;">✓ Advanced Features</li>
                  <li style="padding: 0.5rem 0; opacity: 0.9;">✓ Priority Support</li>
                </ul>
                <button style="width: 100%; padding: 0.875rem; background: white; color: #3b82f6; border: none; border-radius: 0.5rem; font-weight: 600; cursor: pointer;">Get Started</button>
              </div>
              <div style="padding: 2.5rem; background: white; border-radius: 0.75rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <h3 style="font-size: 1.5rem; font-weight: 600; margin-bottom: 0.5rem; color: #0f172a;">Enterprise</h3>
                <div style="font-size: 3rem; font-weight: 700; color: #0f172a; margin-bottom: 1rem;">$199<span style="font-size: 1rem; color: #64748b;">/mo</span></div>
                <ul style="list-style: none; padding: 0; margin-bottom: 2rem;">
                  <li style="padding: 0.5rem 0; color: #475569;">✓ Everything in Pro</li>
                  <li style="padding: 0.5rem 0; color: #475569;">✓ Custom Solutions</li>
                  <li style="padding: 0.5rem 0; color: #475569;">✓ Dedicated Support</li>
                </ul>
                <button style="width: 100%; padding: 0.875rem; background: #3b82f6; color: white; border: none; border-radius: 0.5rem; font-weight: 600; cursor: pointer;">Contact Sales</button>
              </div>
            </div>
          </div>
        </section>
      `,
    },
    
    // Stats Section
    {
      id: 'stats',
      label: 'Stats Section',
      category: 'Sections',
      content: `
        <section style="padding: 4rem 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
          <div style="max-width: 1200px; margin: 0 auto; padding: 0 1rem;">
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 2rem; text-align: center;">
              <div>
                <div style="font-size: 3.5rem; font-weight: 700; margin-bottom: 0.5rem;">10K+</div>
                <div style="font-size: 1.125rem; opacity: 0.9;">Active Users</div>
              </div>
              <div>
                <div style="font-size: 3.5rem; font-weight: 700; margin-bottom: 0.5rem;">50M+</div>
                <div style="font-size: 1.125rem; opacity: 0.9;">Lines of Code</div>
              </div>
              <div>
                <div style="font-size: 3.5rem; font-weight: 700; margin-bottom: 0.5rem;">25K+</div>
                <div style="font-size: 1.125rem; opacity: 0.9;">Projects</div>
              </div>
              <div>
                <div style="font-size: 3.5rem; font-weight: 700; margin-bottom: 0.5rem;">100K+</div>
                <div style="font-size: 1.125rem; opacity: 0.9;">Hours Saved</div>
              </div>
            </div>
          </div>
        </section>
      `,
    },
    
    // Forms
    {
      id: 'form-contact',
      label: 'Contact Form',
      category: 'Forms',
      content: `
        <form style="max-width: 600px; margin: 0 auto; padding: 2rem; background: white; border-radius: 0.75rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <h2 style="font-size: 2rem; font-weight: 700; margin-bottom: 1.5rem; color: #0f172a;">Contact Us</h2>
          <div style="margin-bottom: 1.5rem;">
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #374151;">Name</label>
            <input type="text" style="width: 100%; padding: 0.75rem; border: 1px solid #e5e7eb; border-radius: 0.5rem; font-size: 1rem;" placeholder="Your name" />
          </div>
          <div style="margin-bottom: 1.5rem;">
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #374151;">Email</label>
            <input type="email" style="width: 100%; padding: 0.75rem; border: 1px solid #e5e7eb; border-radius: 0.5rem; font-size: 1rem;" placeholder="your@email.com" />
          </div>
          <div style="margin-bottom: 1.5rem;">
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #374151;">Message</label>
            <textarea style="width: 100%; padding: 0.75rem; border: 1px solid #e5e7eb; border-radius: 0.5rem; font-size: 1rem; min-height: 120px; resize: vertical;" placeholder="Your message"></textarea>
          </div>
          <button type="submit" style="width: 100%; padding: 0.875rem; background: #3b82f6; color: white; border: none; border-radius: 0.5rem; font-size: 1rem; font-weight: 600; cursor: pointer;">Send Message</button>
        </form>
      `,
    },
    
    // Video
    {
      id: 'video',
      label: 'Video',
      category: 'Media',
      content: '<div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; hidden;"><iframe style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" src="https://www.youtube.com/embed/dQw4w9WgXcQ" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>',
    },
    
    // Divider
    {
      id: 'divider',
      label: 'Divider',
      category: 'Layout',
      content: '<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 2rem 0;" />',
    },
    
    // Spacer
    {
      id: 'spacer',
      label: 'Spacer',
      category: 'Layout',
      content: '<div style="height: 3rem;"></div>',
    },
    
    // ==================== NAVIGATION BLOCKS ====================
    {
      id: 'navbar-simple',
      label: 'Simple Navbar',
      category: 'Navigation',
      content: `
        <nav style="background: white; padding: 1rem 2rem; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <div style="font-size: 1.5rem; font-weight: 700; color: #0f172a;">Logo</div>
          <div style="display: flex; gap: 2rem; align-items: center;">
            <a href="#" style="color: #475569; text-decoration: none; font-weight: 500;">Home</a>
            <a href="#" style="color: #475569; text-decoration: none; font-weight: 500;">About</a>
            <a href="#" style="color: #475569; text-decoration: none; font-weight: 500;">Services</a>
            <a href="#" style="color: #475569; text-decoration: none; font-weight: 500;">Contact</a>
            <button style="padding: 0.5rem 1rem; background: #3b82f6; color: white; border: none; border-radius: 0.375rem; font-weight: 500; cursor: pointer;">Get Started</button>
          </div>
        </nav>
      `,
    },
    {
      id: 'navbar-centered',
      label: 'Centered Navbar',
      category: 'Navigation',
      content: `
        <nav style="background: #0f172a; padding: 1rem 2rem;">
          <div style="max-width: 1200px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center;">
            <div style="font-size: 1.5rem; font-weight: 700; color: white;">Brand</div>
            <div style="display: flex; gap: 2rem;">
              <a href="#" style="color: #94a3b8; text-decoration: none; font-weight: 500; transition: color 0.2s;">Home</a>
              <a href="#" style="color: #94a3b8; text-decoration: none; font-weight: 500;">Products</a>
              <a href="#" style="color: #94a3b8; text-decoration: none; font-weight: 500;">Pricing</a>
              <a href="#" style="color: #94a3b8; text-decoration: none; font-weight: 500;">Blog</a>
            </div>
            <div style="display: flex; gap: 1rem;">
              <button style="padding: 0.5rem 1rem; background: transparent; color: white; border: 1px solid #475569; border-radius: 0.375rem; font-weight: 500; cursor: pointer;">Sign In</button>
              <button style="padding: 0.5rem 1rem; background: #3b82f6; color: white; border: none; border-radius: 0.375rem; font-weight: 500; cursor: pointer;">Sign Up</button>
            </div>
          </div>
        </nav>
      `,
    },
    {
      id: 'breadcrumbs',
      label: 'Breadcrumbs',
      category: 'Navigation',
      content: `
        <nav style="padding: 1rem 2rem; background: #f8fafc;">
          <ol style="display: flex; gap: 0.5rem; list-style: none; margin: 0; padding: 0; font-size: 0.875rem;">
            <li><a href="#" style="color: #3b82f6; text-decoration: none;">Home</a></li>
            <li style="color: #94a3b8;">/</li>
            <li><a href="#" style="color: #3b82f6; text-decoration: none;">Products</a></li>
            <li style="color: #94a3b8;">/</li>
            <li style="color: #475569;">Current Page</li>
          </ol>
        </nav>
      `,
    },
    {
      id: 'sidebar-nav',
      label: 'Sidebar Navigation',
      category: 'Navigation',
      content: `
        <aside style="width: 250px; background: #1e293b; padding: 1.5rem; min-height: 400px;">
          <div style="font-size: 1.25rem; font-weight: 700; color: white; margin-bottom: 2rem;">Dashboard</div>
          <nav style="display: flex; flex-direction: column; gap: 0.5rem;">
            <a href="#" style="padding: 0.75rem 1rem; background: #3b82f6; color: white; text-decoration: none; border-radius: 0.5rem; font-weight: 500;">Overview</a>
            <a href="#" style="padding: 0.75rem 1rem; color: #94a3b8; text-decoration: none; border-radius: 0.5rem; font-weight: 500;">Analytics</a>
            <a href="#" style="padding: 0.75rem 1rem; color: #94a3b8; text-decoration: none; border-radius: 0.5rem; font-weight: 500;">Reports</a>
            <a href="#" style="padding: 0.75rem 1rem; color: #94a3b8; text-decoration: none; border-radius: 0.5rem; font-weight: 500;">Settings</a>
          </nav>
        </aside>
      `,
    },
    
    // ==================== FOOTER BLOCKS ====================
    {
      id: 'footer-simple',
      label: 'Simple Footer',
      category: 'Footer',
      content: `
        <footer style="background: #0f172a; color: white; padding: 3rem 2rem;">
          <div style="max-width: 1200px; margin: 0 auto; text-align: center;">
            <div style="font-size: 1.5rem; font-weight: 700; margin-bottom: 1rem;">Company Name</div>
            <div style="display: flex; justify-content: center; gap: 2rem; margin-bottom: 2rem;">
              <a href="#" style="color: #94a3b8; text-decoration: none;">About</a>
              <a href="#" style="color: #94a3b8; text-decoration: none;">Privacy</a>
              <a href="#" style="color: #94a3b8; text-decoration: none;">Terms</a>
              <a href="#" style="color: #94a3b8; text-decoration: none;">Contact</a>
            </div>
            <p style="color: #64748b; font-size: 0.875rem;">© 2024 Company Name. All rights reserved.</p>
          </div>
        </footer>
      `,
    },
    {
      id: 'footer-multi-column',
      label: 'Multi-Column Footer',
      category: 'Footer',
      content: `
        <footer style="background: #0f172a; color: white; padding: 4rem 2rem 2rem;">
          <div style="max-width: 1200px; margin: 0 auto;">
            <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 3rem; margin-bottom: 3rem;">
              <div>
                <div style="font-size: 1.5rem; font-weight: 700; margin-bottom: 1rem;">Company</div>
                <p style="color: #94a3b8; line-height: 1.6;">Building the future of digital experiences with innovative solutions.</p>
              </div>
              <div>
                <div style="font-weight: 600; margin-bottom: 1rem;">Product</div>
                <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                  <a href="#" style="color: #94a3b8; text-decoration: none;">Features</a>
                  <a href="#" style="color: #94a3b8; text-decoration: none;">Pricing</a>
                  <a href="#" style="color: #94a3b8; text-decoration: none;">Integrations</a>
                  <a href="#" style="color: #94a3b8; text-decoration: none;">FAQ</a>
                </div>
              </div>
              <div>
                <div style="font-weight: 600; margin-bottom: 1rem;">Company</div>
                <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                  <a href="#" style="color: #94a3b8; text-decoration: none;">About</a>
                  <a href="#" style="color: #94a3b8; text-decoration: none;">Blog</a>
                  <a href="#" style="color: #94a3b8; text-decoration: none;">Careers</a>
                  <a href="#" style="color: #94a3b8; text-decoration: none;">Press</a>
                </div>
              </div>
              <div>
                <div style="font-weight: 600; margin-bottom: 1rem;">Legal</div>
                <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                  <a href="#" style="color: #94a3b8; text-decoration: none;">Privacy</a>
                  <a href="#" style="color: #94a3b8; text-decoration: none;">Terms</a>
                  <a href="#" style="color: #94a3b8; text-decoration: none;">Security</a>
                </div>
              </div>
            </div>
            <div style="border-top: 1px solid #334155; padding-top: 2rem; text-align: center;">
              <p style="color: #64748b; font-size: 0.875rem;">© 2024 Company Name. All rights reserved.</p>
            </div>
          </div>
        </footer>
      `,
    },
    {
      id: 'footer-newsletter',
      label: 'Footer with Newsletter',
      category: 'Footer',
      content: `
        <footer style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); color: white; padding: 4rem 2rem;">
          <div style="max-width: 800px; margin: 0 auto; text-align: center;">
            <div style="font-size: 2rem; font-weight: 700; margin-bottom: 1rem;">Stay Updated</div>
            <p style="color: #94a3b8; margin-bottom: 2rem;">Subscribe to our newsletter for the latest updates and insights.</p>
            <div style="display: flex; gap: 1rem; justify-content: center; margin-bottom: 3rem;">
              <input type="email" placeholder="Enter your email" style="padding: 0.75rem 1rem; border: none; border-radius: 0.5rem; width: 300px; font-size: 1rem;" />
              <button style="padding: 0.75rem 2rem; background: #3b82f6; color: white; border: none; border-radius: 0.5rem; font-weight: 600; cursor: pointer;">Subscribe</button>
            </div>
            <div style="display: flex; justify-content: center; gap: 1.5rem; margin-bottom: 2rem;">
              <a href="#" style="color: #94a3b8; text-decoration: none;">Twitter</a>
              <a href="#" style="color: #94a3b8; text-decoration: none;">LinkedIn</a>
              <a href="#" style="color: #94a3b8; text-decoration: none;">GitHub</a>
            </div>
            <p style="color: #64748b; font-size: 0.875rem;">© 2024 Company. All rights reserved.</p>
          </div>
        </footer>
      `,
    },
    
    // ==================== CARD BLOCKS ====================
    {
      id: 'card-product',
      label: 'Product Card',
      category: 'Cards',
      content: `
        <div style="background: white; border-radius: 0.75rem; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); max-width: 320px;">
          <img src="https://via.placeholder.com/320x200/3b82f6/ffffff?text=Product" style="width: 100%; height: 200px; object-fit: cover;" />
          <div style="padding: 1.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
              <span style="color: #64748b; font-size: 0.875rem;">Category</span>
              <span style="background: #dcfce7; color: #166534; padding: 0.25rem 0.75rem; border-radius: 1rem; font-size: 0.75rem; font-weight: 600;">New</span>
            </div>
            <h3 style="font-size: 1.25rem; font-weight: 600; color: #0f172a; margin-bottom: 0.5rem;">Product Name</h3>
            <p style="color: #64748b; font-size: 0.875rem; margin-bottom: 1rem; line-height: 1.5;">Short product description goes here with key features.</p>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 1.5rem; font-weight: 700; color: #0f172a;">$99</span>
              <button style="padding: 0.5rem 1rem; background: #3b82f6; color: white; border: none; border-radius: 0.375rem; font-weight: 500; cursor: pointer;">Add to Cart</button>
            </div>
          </div>
        </div>
      `,
    },
    {
      id: 'card-team',
      label: 'Team Member Card',
      category: 'Cards',
      content: `
        <div style="background: white; border-radius: 0.75rem; padding: 2rem; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.1); max-width: 280px;">
          <div style="width: 120px; height: 120px; background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); border-radius: 50%; margin: 0 auto 1.5rem;"></div>
          <h3 style="font-size: 1.25rem; font-weight: 600; color: #0f172a; margin-bottom: 0.25rem;">John Doe</h3>
          <p style="color: #3b82f6; font-weight: 500; margin-bottom: 1rem;">CEO & Founder</p>
          <p style="color: #64748b; font-size: 0.875rem; line-height: 1.6; margin-bottom: 1.5rem;">Passionate about building products that make a difference.</p>
          <div style="display: flex; justify-content: center; gap: 1rem;">
            <a href="#" style="color: #64748b;">🐦</a>
            <a href="#" style="color: #64748b;">💼</a>
            <a href="#" style="color: #64748b;">📧</a>
          </div>
        </div>
      `,
    },
    {
      id: 'card-blog',
      label: 'Blog Post Card',
      category: 'Cards',
      content: `
        <article style="background: white; border-radius: 0.75rem; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); max-width: 380px;">
          <img src="https://via.placeholder.com/380x200/8b5cf6/ffffff?text=Blog+Post" style="width: 100%; height: 200px; object-fit: cover;" />
          <div style="padding: 1.5rem;">
            <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem;">
              <span style="background: #ede9fe; color: #7c3aed; padding: 0.25rem 0.75rem; border-radius: 1rem; font-size: 0.75rem; font-weight: 600;">Technology</span>
              <span style="color: #64748b; font-size: 0.75rem;">5 min read</span>
            </div>
            <h3 style="font-size: 1.25rem; font-weight: 600; color: #0f172a; margin-bottom: 0.75rem; line-height: 1.3;">How to Build Better Products with AI</h3>
            <p style="color: #64748b; font-size: 0.875rem; line-height: 1.6; margin-bottom: 1.5rem;">Discover the latest techniques for integrating AI into your product development workflow...</p>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div style="display: flex; align-items: center; gap: 0.75rem;">
                <div style="width: 36px; height: 36px; background: #3b82f6; border-radius: 50%;"></div>
                <div>
                  <div style="font-weight: 500; color: #0f172a; font-size: 0.875rem;">Jane Smith</div>
                  <div style="color: #64748b; font-size: 0.75rem;">Dec 15, 2024</div>
                </div>
              </div>
              <a href="#" style="color: #3b82f6; font-weight: 500; text-decoration: none;">Read more →</a>
            </div>
          </div>
        </article>
      `,
    },
    {
      id: 'card-pricing',
      label: 'Pricing Card',
      category: 'Cards',
      content: `
        <div style="background: white; border-radius: 0.75rem; padding: 2rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1); max-width: 320px; border: 2px solid #e2e8f0;">
          <div style="text-align: center; margin-bottom: 1.5rem;">
            <h3 style="font-size: 1.25rem; font-weight: 600; color: #0f172a; margin-bottom: 0.5rem;">Professional</h3>
            <p style="color: #64748b; font-size: 0.875rem;">Best for growing teams</p>
          </div>
          <div style="text-align: center; margin-bottom: 1.5rem;">
            <span style="font-size: 3rem; font-weight: 700; color: #0f172a;">$49</span>
            <span style="color: #64748b;">/month</span>
          </div>
          <ul style="list-style: none; padding: 0; margin-bottom: 2rem;">
            <li style="padding: 0.75rem 0; border-bottom: 1px solid #f1f5f9; color: #475569;">✓ Unlimited projects</li>
            <li style="padding: 0.75rem 0; border-bottom: 1px solid #f1f5f9; color: #475569;">✓ Advanced analytics</li>
            <li style="padding: 0.75rem 0; border-bottom: 1px solid #f1f5f9; color: #475569;">✓ Priority support</li>
            <li style="padding: 0.75rem 0; color: #475569;">✓ Custom integrations</li>
          </ul>
          <button style="width: 100%; padding: 0.875rem; background: #3b82f6; color: white; border: none; border-radius: 0.5rem; font-weight: 600; cursor: pointer;">Get Started</button>
        </div>
      `,
    },
    
    // ==================== CTA BLOCKS ====================
    {
      id: 'cta-banner',
      label: 'CTA Banner',
      category: 'CTA',
      content: `
        <section style="background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); padding: 4rem 2rem; text-align: center;">
          <div style="max-width: 800px; margin: 0 auto;">
            <h2 style="font-size: 2.5rem; font-weight: 700; color: white; margin-bottom: 1rem;">Ready to Get Started?</h2>
            <p style="font-size: 1.25rem; color: rgba(255,255,255,0.9); margin-bottom: 2rem;">Join thousands of users who are already building amazing things.</p>
            <div style="display: flex; gap: 1rem; justify-content: center;">
              <button style="padding: 1rem 2rem; background: white; color: #3b82f6; border: none; border-radius: 0.5rem; font-size: 1rem; font-weight: 600; cursor: pointer;">Start Free Trial</button>
              <button style="padding: 1rem 2rem; background: transparent; color: white; border: 2px solid white; border-radius: 0.5rem; font-size: 1rem; font-weight: 600; cursor: pointer;">Contact Sales</button>
            </div>
          </div>
        </section>
      `,
    },
    {
      id: 'cta-floating',
      label: 'Floating CTA Box',
      category: 'CTA',
      content: `
        <div style="background: white; border-radius: 1rem; padding: 2rem; box-shadow: 0 20px 40px rgba(0,0,0,0.15); max-width: 400px; margin: 2rem auto;">
          <div style="text-align: center;">
            <div style="width: 64px; height: 64px; background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); border-radius: 1rem; margin: 0 auto 1.5rem; display: flex; align-items: center; justify-content: center; font-size: 2rem;">🚀</div>
            <h3 style="font-size: 1.5rem; font-weight: 700; color: #0f172a; margin-bottom: 0.75rem;">Launch Your Project</h3>
            <p style="color: #64748b; margin-bottom: 1.5rem; line-height: 1.6;">Get started in minutes with our intuitive platform.</p>
            <button style="width: 100%; padding: 0.875rem; background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); color: white; border: none; border-radius: 0.5rem; font-weight: 600; cursor: pointer; font-size: 1rem;">Get Started Free</button>
            <p style="color: #94a3b8; font-size: 0.75rem; margin-top: 1rem;">No credit card required</p>
          </div>
        </div>
      `,
    },
    {
      id: 'cta-inline',
      label: 'Inline CTA',
      category: 'CTA',
      content: `
        <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 0.75rem; padding: 1.5rem 2rem; display: flex; justify-content: space-between; align-items: center; max-width: 800px; margin: 2rem auto;">
          <div>
            <h4 style="font-size: 1.125rem; font-weight: 600; color: #0c4a6e; margin-bottom: 0.25rem;">Upgrade to Pro</h4>
            <p style="color: #0369a1; font-size: 0.875rem;">Unlock all features and get priority support.</p>
          </div>
          <button style="padding: 0.75rem 1.5rem; background: #0284c7; color: white; border: none; border-radius: 0.5rem; font-weight: 600; cursor: pointer; white-space: nowrap;">Upgrade Now</button>
        </div>
      `,
    },
    
    // ==================== SOCIAL BLOCKS ====================
    {
      id: 'social-share',
      label: 'Social Share Buttons',
      category: 'Social',
      content: `
        <div style="display: flex; gap: 1rem; justify-content: center; padding: 1rem;">
          <a href="#" style="width: 48px; height: 48px; background: #1da1f2; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; text-decoration: none; font-size: 1.25rem;">𝕏</a>
          <a href="#" style="width: 48px; height: 48px; background: #4267b2; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; text-decoration: none; font-size: 1.25rem;">f</a>
          <a href="#" style="width: 48px; height: 48px; background: #0077b5; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; text-decoration: none; font-size: 1.25rem;">in</a>
          <a href="#" style="width: 48px; height: 48px; background: linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; text-decoration: none; font-size: 1.25rem;">📷</a>
        </div>
      `,
    },
    {
      id: 'social-follow',
      label: 'Social Follow Section',
      category: 'Social',
      content: `
        <div style="background: #f8fafc; padding: 3rem 2rem; text-align: center;">
          <h3 style="font-size: 1.5rem; font-weight: 600; color: #0f172a; margin-bottom: 0.5rem;">Follow Us</h3>
          <p style="color: #64748b; margin-bottom: 1.5rem;">Stay connected on social media</p>
          <div style="display: flex; gap: 1rem; justify-content: center;">
            <a href="#" style="padding: 0.75rem 1.5rem; background: white; border: 1px solid #e2e8f0; border-radius: 0.5rem; color: #475569; text-decoration: none; font-weight: 500; display: flex; align-items: center; gap: 0.5rem;">🐦 Twitter</a>
            <a href="#" style="padding: 0.75rem 1.5rem; background: white; border: 1px solid #e2e8f0; border-radius: 0.5rem; color: #475569; text-decoration: none; font-weight: 500; display: flex; align-items: center; gap: 0.5rem;">💼 LinkedIn</a>
            <a href="#" style="padding: 0.75rem 1.5rem; background: white; border: 1px solid #e2e8f0; border-radius: 0.5rem; color: #475569; text-decoration: none; font-weight: 500; display: flex; align-items: center; gap: 0.5rem;">📺 YouTube</a>
          </div>
        </div>
      `,
    },
    {
      id: 'social-feed',
      label: 'Social Feed Embed',
      category: 'Social',
      content: `
        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 0.75rem; padding: 1.5rem; max-width: 400px;">
          <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem;">
            <div style="width: 48px; height: 48px; background: #3b82f6; border-radius: 50%;"></div>
            <div>
              <div style="font-weight: 600; color: #0f172a;">Company Name</div>
              <div style="color: #64748b; font-size: 0.875rem;">@companyhandle</div>
            </div>
          </div>
          <p style="color: #0f172a; line-height: 1.6; margin-bottom: 1rem;">Just launched our new feature! 🚀 Check it out and let us know what you think. We're excited to hear your feedback!</p>
          <div style="display: flex; gap: 1.5rem; color: #64748b; font-size: 0.875rem;">
            <span>❤️ 234</span>
            <span>💬 56</span>
            <span>🔄 12</span>
          </div>
        </div>
      `,
    },
  ];

  // Initialize GrapesJS editor
  useEffect(() => {
    if (!editorRef.current) return;
    
    // Ensure container is mounted and has dimensions before initializing
    const container = editorRef.current;
    if (!container) return;
    
    // Wait for container to be visible
    const checkAndInit = () => {
      if (!editorRef.current || grapesEditorRef.current) return;
      
      const el = editorRef.current;
      // Check if element is visible and has dimensions
      if (el.offsetWidth === 0 && el.offsetHeight === 0) {
        // Not ready yet, try again
        setTimeout(checkAndInit, 50);
        return;
      }
      
      initializeEditor();
    };
    
    // Small delay to ensure DOM is ready
    const initTimer = setTimeout(checkAndInit, 100);
    
    function initializeEditor() {
      if (!editorRef.current || grapesEditorRef.current) return;

      // Initialize GrapesJS editor with all plugins and comprehensive configuration
      const editor = grapesjs.init({
        container: editorRef.current,
        height: '100%',
        width: '100%',
        fromElement: false,
        noticeOnUnload: false,
        showOffsets: true,
        showOffsetsSelected: true,
        
        // Enable all installed plugins
        plugins: [
          gjsBlocksBasic,
          gjsPresetWebpage,
          gjsForms,
          gjsExport,
          gjsTabs,
          gjsTooltip,
          gjsTouch,
        ],
        pluginsOpts: {
          [gjsBlocksBasic as any]: {
            flexGrid: true,
            stylePrefix: 'gjs-',
          },
          [gjsPresetWebpage as any]: {
            modalImportTitle: 'Import Template',
            modalImportLabel: '<div style="margin-bottom: 10px; font-size: 13px;">Paste your HTML/CSS here</div>',
            modalImportContent: '',
            importViewerRecursive: true,
            textCleanCanvas: 'Are you sure you want to clear the canvas?',
            showStylesOnChange: true,
            useCustomTheme: false,
          },
          [gjsForms as any]: {
            blocks: ['form', 'input', 'textarea', 'select', 'button', 'label', 'checkbox', 'radio'],
          },
          [gjsExport as any]: {
            addExportBtn: false,
            btnLabel: 'Export',
            filenamePfx: 'grapes-page',
            filename: (editor: Editor) => `${currentPageKey}-export`,
          },
          [gjsTabs as any]: {
            tabsBlock: { category: 'Extra' },
          },
          [gjsTooltip as any]: {
            blockLabel: 'Tooltip',
            blockCategory: 'Extra',
          },
          [gjsTouch as any]: {},
        },
        
        // Storage manager with auto-save
        storageManager: {
          type: 'local',
          autosave: autoSaveEnabled,
          autoload: false,
          stepsBeforeSave: 3,
          options: {
            local: {
              key: `gjs-page-${currentPageKey}`,
            },
          },
        },
        
        // Asset manager for images
        assetManager: {
          embedAsBase64: true,
          upload: false,
          uploadName: 'files',
        },
        
        // Comprehensive block manager - merge with plugin blocks
        blockManager: {
          appendTo: '.blocks__container',
          blocks: getBlocks(),
        },
        
        // Canvas configuration with base CSS
        canvas: {
          styles: [
            // Base styles for the canvas
          ],
          scripts: [],
        },
        
        // Device manager for responsive design
        deviceManager: {
          devices: [
            {
              name: 'Desktop',
              width: '',
            },
            {
              name: 'Tablet',
              width: '768px',
              widthMedia: '992px',
            },
            {
              name: 'Mobile',
              width: '320px',
              widthMedia: '768px',
            },
          ],
        },
        
        // Panels configuration
        panels: {
          defaults: [
            {
              id: 'layers',
              el: '.panel__right',
              resizable: false,
            },
            {
              id: 'panel-devices',
              el: '.panel__devices',
              buttons: [
                {
                  id: 'device-desktop',
                  label: '<i>DT</i>',
                  command: 'set-device-desktop',
                  active: true,
                  togglable: false,
                },
                {
                  id: 'device-tablet',
                  label: '<i>TB</i>',
                  command: 'set-device-tablet',
                  togglable: false,
                },
                {
                  id: 'device-mobile',
                  label: '<i>MB</i>',
                  command: 'set-device-mobile',
                  togglable: false,
                },
              ],
            },
          ],
        },
        
        // Layer manager
        layerManager: {
          appendTo: '.layers__container',
        },
        
        // Comprehensive style manager
        styleManager: {
          appendTo: '.styles__container',
          sectors: [
            {
              name: 'Dimension',
              open: false,
              buildProps: ['width', 'min-height', 'padding'],
              properties: [
                {
                  type: 'integer',
                  name: 'Width',
                  property: 'width',
                  units: ['px', '%', 'rem', 'em'],
                  defaults: 'auto',
                  min: 0,
                },
                {
                  type: 'integer',
                  name: 'Min Height',
                  property: 'min-height',
                  units: ['px', '%', 'rem', 'em', 'vh'],
                  defaults: 'auto',
                  min: 0,
                },
                {
                  type: 'integer',
                  name: 'Padding',
                  property: 'padding',
                  units: ['px', 'rem', 'em'],
                  defaults: '0',
                  min: 0,
                },
              ],
            },
            {
              name: 'Extra',
              open: false,
              buildProps: ['background-color', 'box-shadow', 'custom-prop'],
              properties: [
                {
                  name: 'Background Color',
                  property: 'background-color',
                  type: 'color',
                },
                {
                  name: 'Box Shadow',
                  property: 'box-shadow',
                  type: 'composite',
                  properties: [
                    {
                      name: 'X',
                      type: 'integer',
                      defaults: 0,
                      units: ['px'],
                    },
                    {
                      name: 'Y',
                      type: 'integer',
                      defaults: 0,
                      units: ['px'],
                    },
                    {
                      name: 'Blur',
                      type: 'integer',
                      defaults: 5,
                      units: ['px'],
                    },
                    {
                      name: 'Spread',
                      type: 'integer',
                      defaults: 0,
                      units: ['px'],
                    },
                    {
                      name: 'Color',
                      type: 'color',
                      defaults: 'black',
                    },
                  ],
                },
              ],
            },
            {
              name: 'Typography',
              open: false,
              buildProps: ['font-family', 'font-size', 'font-weight', 'letter-spacing', 'color', 'line-height', 'text-align', 'text-decoration', 'text-shadow'],
              properties: [
                {
                  name: 'Font Family',
                  property: 'font-family',
                  type: 'select',
                  defaults: 'Arial',
                  options: [
                    { value: 'Arial', name: 'Arial' },
                    { value: 'Helvetica', name: 'Helvetica' },
                    { value: 'Georgia', name: 'Georgia' },
                    { value: 'Times New Roman', name: 'Times New Roman' },
                    { value: 'Courier New', name: 'Courier New' },
                    { value: 'Verdana', name: 'Verdana' },
                    { value: 'system-ui', name: 'System UI' },
                    { value: '-apple-system', name: 'Apple System' },
                  ],
                },
                {
                  type: 'integer',
                  name: 'Font Size',
                  property: 'font-size',
                  units: ['px', 'rem', 'em'],
                  defaults: '16px',
                  min: 8,
                  max: 100,
                },
                {
                  type: 'select',
                  name: 'Font Weight',
                  property: 'font-weight',
                  defaults: '400',
                  options: [
                    { value: '100', name: 'Thin' },
                    { value: '200', name: 'Extra Light' },
                    { value: '300', name: 'Light' },
                    { value: '400', name: 'Normal' },
                    { value: '500', name: 'Medium' },
                    { value: '600', name: 'Semi Bold' },
                    { value: '700', name: 'Bold' },
                    { value: '800', name: 'Extra Bold' },
                    { value: '900', name: 'Black' },
                  ],
                },
                {
                  name: 'Text Color',
                  property: 'color',
                  type: 'color',
                },
                {
                  type: 'select',
                  name: 'Text Align',
                  property: 'text-align',
                  defaults: 'left',
                  options: [
                    { value: 'left', name: 'Left' },
                    { value: 'center', name: 'Center' },
                    { value: 'right', name: 'Right' },
                    { value: 'justify', name: 'Justify' },
                  ],
                },
              ],
            },
            {
              name: 'Decorations',
              open: false,
              buildProps: ['opacity', 'border-radius', 'border', 'box-shadow', 'background'],
              properties: [
                {
                  type: 'slider',
                  name: 'Opacity',
                  property: 'opacity',
                  defaults: 1,
                  step: 0.01,
                  max: 1,
                  min: 0,
                },
                {
                  type: 'integer',
                  name: 'Border Radius',
                  property: 'border-radius',
                  units: ['px', '%'],
                  defaults: '0',
                  min: 0,
                },
                {
                  name: 'Border',
                  property: 'border',
                  type: 'composite',
                  properties: [
                    {
                      name: 'Width',
                      type: 'integer',
                      defaults: 0,
                      units: ['px'],
                      min: 0,
                    },
                    {
                      name: 'Style',
                      type: 'select',
                      defaults: 'solid',
                      options: [
                        { value: 'solid', name: 'Solid' },
                        { value: 'dashed', name: 'Dashed' },
                        { value: 'dotted', name: 'Dotted' },
                        { value: 'double', name: 'Double' },
                        { value: 'none', name: 'None' },
                      ],
                    },
                    {
                      name: 'Color',
                      type: 'color',
                      defaults: 'black',
                    },
                  ],
                },
              ],
            },
            {
              name: 'Flex',
              open: false,
              buildProps: ['flex-direction', 'flex-wrap', 'justify-content', 'align-items', 'align-content', 'order'],
              properties: [
                {
                  name: 'Flex Direction',
                  property: 'flex-direction',
                  type: 'select',
                  defaults: 'row',
                  options: [
                    { value: 'row', name: 'Row' },
                    { value: 'row-reverse', name: 'Row Reverse' },
                    { value: 'column', name: 'Column' },
                    { value: 'column-reverse', name: 'Column Reverse' },
                  ],
                },
                {
                  name: 'Justify Content',
                  property: 'justify-content',
                  type: 'select',
                  defaults: 'flex-start',
                  options: [
                    { value: 'flex-start', name: 'Flex Start' },
                    { value: 'flex-end', name: 'Flex End' },
                    { value: 'center', name: 'Center' },
                    { value: 'space-between', name: 'Space Between' },
                    { value: 'space-around', name: 'Space Around' },
                    { value: 'space-evenly', name: 'Space Evenly' },
                  ],
                },
                {
                  name: 'Align Items',
                  property: 'align-items',
                  type: 'select',
                  defaults: 'stretch',
                  options: [
                    { value: 'stretch', name: 'Stretch' },
                    { value: 'flex-start', name: 'Flex Start' },
                    { value: 'flex-end', name: 'Flex End' },
                    { value: 'center', name: 'Center' },
                    { value: 'baseline', name: 'Baseline' },
                  ],
                },
              ],
            },
          ],
        },
        
        // Trait manager for component properties
        traitManager: {
          appendTo: '.traits__container',
        },
        
        // Selector manager
        selectorManager: {
          appendTo: '.selectors__container',
        },
      });

      grapesEditorRef.current = editor;

      // Load content from backend after editor is ready
      setTimeout(() => {
        loadContent(editor);
      }, 200);

      // Set up custom commands
      editor.Commands.add('save-page', {
        run: (editor: any) => {
          handleSave(editor);
        },
      });

      editor.Commands.add('preview-page', {
        run: (editor: any) => {
          const html = editor.getHtml();
          const css = editor.getCss();
          const previewWindow = window.open('', '_blank');
          if (previewWindow) {
            previewWindow.document.write(`
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <title>Page Preview</title>
                <style>${css}</style>
                <script src="https://cdn.tailwindcss.com"></script>
              </head>
              <body style="margin: 0; padding: 0;">${html}</body>
              </html>
            `);
          }
        },
      });

      // Device switching commands
      editor.Commands.add('set-device-desktop', {
        run: (editor: any) => {
          editor.setDevice('Desktop');
        },
      });

      editor.Commands.add('set-device-tablet', {
        run: (editor: any) => {
          editor.setDevice('Tablet');
        },
      });

      editor.Commands.add('set-device-mobile', {
        run: (editor: any) => {
          editor.setDevice('Mobile');
        },
      });

      // Undo/Redo commands
      editor.Commands.add('core:undo', {
        run: (editor: any) => {
          editor.UndoManager.undo();
        },
      });

      editor.Commands.add('core:redo', {
        run: (editor: any) => {
          editor.UndoManager.redo();
        },
      });

      // Update code view when content changes
      editor.on('update', () => {
        if (showCode) {
          updateCodeView();
        }
      });

      // Auto-save on changes (debounced)
      editor.on('change:changesCount', () => {
        if (autoSaveEnabled && autoSaveTimerRef.current) {
          clearTimeout(autoSaveTimerRef.current);
        }
        if (autoSaveEnabled) {
          autoSaveTimerRef.current = setTimeout(() => {
            handleAutoSave(editor);
          }, 5000); // Auto-save after 5 seconds of inactivity
        }
      });

      // Keyboard shortcuts
      document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
          e.preventDefault();
          handleSave(editor);
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
          if (!e.shiftKey) {
            e.preventDefault();
            editor.UndoManager.undo();
          }
        }
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') {
          e.preventDefault();
          editor.UndoManager.redo();
        }
      });

      setLoading(false);
    }

    // Auto-save handler
    const handleAutoSave = async (editor: Editor) => {
      try {
        const html = editor.getHtml();
        const css = editor.getCss();
        
        // Save to local storage as backup
        localStorage.setItem(`gjs-autosave-${currentPageKey}`, JSON.stringify({
          html,
          css,
          timestamp: new Date().toISOString(),
        }));
        
        console.log('[GrapesJS] Auto-saved to local storage');
      } catch (err) {
        console.warn('[GrapesJS] Auto-save failed:', err);
      }
    };

    return () => {
      clearTimeout(initTimer);
      if (grapesEditorRef.current) {
        grapesEditorRef.current.destroy();
        grapesEditorRef.current = null;
      }
    };
  }, [token, pageKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update code view
  const updateCodeView = () => {
    if (!grapesEditorRef.current) return;
    setCodeContent({
      html: grapesEditorRef.current.getHtml(),
      css: grapesEditorRef.current.getCss(),
    });
  };

  // Load content from backend
  const loadContent = async (editor: any) => {
    try {
      setLoading(true);
      setError(null);

      let pageContent: PageContent | null = null;
      
      try {
        pageContent = await getPageContent(token, pageKey);
      } catch (err: any) {
        console.warn('Failed to load page content:', err);
        // Start with empty editor
        return;
      }

      if (!pageContent || !pageContent.sections) {
        return;
      }

      // Convert sections to HTML - improved conversion
      let html = '';
      let css = '';

      Object.entries(pageContent.sections).forEach(([key, section]) => {
        const content = section.content;
        
        // If HTML/CSS already exists, use it directly
        if (content.html) {
          html += content.html;
          if (content.css) {
            css += content.css;
          }
        } else {
          // Convert structured content to HTML
          const sectionHtml = convertSectionToHTML(key, content);
          html += sectionHtml;
        }
      });

      if (html) {
        editor.setComponents(html);
        if (css) {
          editor.setStyle(css);
        }
      }
    } catch (err: any) {
      console.error('Failed to load content:', err);
      setError(err.message || 'Failed to load page content');
    } finally {
      setLoading(false);
    }
  };

  // Convert section content to HTML
  const convertSectionToHTML = (sectionKey: string, content: any): string => {
    switch (sectionKey) {
      case 'hero':
        return `
          <section class="section-hero" style="padding: 5rem 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-align: center;">
            <div style="max-width: 800px; margin: 0 auto; padding: 0 1rem;">
              ${content.title ? `<h1 style="font-size: 3.5rem; font-weight: 700; margin-bottom: 1.5rem;">${content.title}</h1>` : ''}
              ${content.subtitle ? `<h2 style="font-size: 1.5rem; margin-bottom: 1rem; opacity: 0.9;">${content.subtitle}</h2>` : ''}
              ${content.description ? `<p style="font-size: 1.25rem; margin-bottom: 2rem; opacity: 0.9;">${content.description}</p>` : ''}
              ${content.buttons && content.buttons.length > 0 ? `
                <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
                  ${content.buttons.map((btn: any) => `
                    <button style="padding: 0.875rem 2rem; ${btn.variant === 'primary' ? 'background: white; color: #667eea;' : 'background: transparent; color: white; border: 2px solid white;'} border: none; border-radius: 0.5rem; font-size: 1rem; font-weight: 600; cursor: pointer;">${btn.text}</button>
                  `).join('')}
                </div>
              ` : ''}
            </div>
          </section>
        `;
      
      case 'features':
        return `
          <section class="section-features" style="padding: 4rem 0; background: white;">
            <div style="max-width: 1200px; margin: 0 auto; padding: 0 1rem;">
              ${content.title ? `<h2 style="font-size: 2.5rem; font-weight: 700; margin-bottom: 1rem; text-align: center; color: #0f172a;">${content.title}</h2>` : ''}
              ${content.description ? `<p style="font-size: 1.125rem; color: #64748b; text-align: center; max-width: 600px; margin: 0 auto 3rem;">${content.description}</p>` : ''}
              ${content.features && content.features.length > 0 ? `
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 2rem;">
                  ${content.features.map((feature: any) => `
                    <div style="padding: 2rem; background: #f8fafc; border-radius: 0.75rem; text-align: center;">
                      ${feature.icon ? `<div style="font-size: 3rem; margin-bottom: 1rem;">${feature.icon}</div>` : ''}
                      <h3 style="font-size: 1.5rem; font-weight: 600; margin-bottom: 0.75rem; color: #0f172a;">${feature.title}</h3>
                      <p style="color: #64748b; line-height: 1.6;">${feature.description}</p>
                    </div>
                  `).join('')}
                </div>
              ` : ''}
            </div>
          </section>
        `;
      
      case 'testimonials':
        return `
          <section class="section-testimonials" style="padding: 4rem 0; background: #f8fafc;">
            <div style="max-width: 1200px; margin: 0 auto; padding: 0 1rem;">
              ${content.title ? `<h2 style="font-size: 2.5rem; font-weight: 700; margin-bottom: 3rem; text-align: center; color: #0f172a;">${content.title}</h2>` : ''}
              ${content.testimonials && content.testimonials.length > 0 ? `
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 2rem;">
                  ${content.testimonials.map((testimonial: any) => `
                    <div style="padding: 2rem; background: white; border-radius: 0.75rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                      ${testimonial.rating ? `<div style="margin-bottom: 1rem; color: #fbbf24;">${'★'.repeat(testimonial.rating)}</div>` : ''}
                      <p style="color: #475569; margin-bottom: 1.5rem; line-height: 1.6; font-style: italic;">"${testimonial.content}"</p>
                      <div style="display: flex; align-items: center; gap: 1rem;">
                        ${testimonial.avatar ? `<img src="${testimonial.avatar}" style="width: 48px; height: 48px; border-radius: 50%;" />` : '<div style="width: 48px; height: 48px; background: #3b82f6; border-radius: 50%;"></div>'}
                        <div>
                          <div style="font-weight: 600; color: #0f172a;">${testimonial.name}</div>
                          <div style="font-size: 0.875rem; color: #64748b;">${testimonial.role}, ${testimonial.company}</div>
                        </div>
                      </div>
                    </div>
                  `).join('')}
                </div>
              ` : ''}
            </div>
          </section>
        `;
      
      case 'faq':
        return `
          <section class="section-faq" style="padding: 4rem 0; background: white;">
            <div style="max-width: 800px; margin: 0 auto; padding: 0 1rem;">
              ${content.title ? `<h2 style="font-size: 2.5rem; font-weight: 700; margin-bottom: 3rem; text-align: center; color: #0f172a;">${content.title}</h2>` : ''}
              ${content.faqs && content.faqs.length > 0 ? `
                <div style="display: flex; flex-direction: column; gap: 1rem;">
                  ${content.faqs.map((faq: any) => `
                    <div style="padding: 1.5rem; background: #f8fafc; border-radius: 0.5rem;">
                      <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.75rem; color: #0f172a;">${faq.question}</h3>
                      <p style="color: #64748b; line-height: 1.6;">${faq.answer}</p>
                    </div>
                  `).join('')}
                </div>
              ` : ''}
            </div>
          </section>
        `;
      
      case 'stats':
        return `
          <section class="section-stats" style="padding: 4rem 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
            <div style="max-width: 1200px; margin: 0 auto; padding: 0 1rem;">
              ${content.title ? `<h2 style="font-size: 2.5rem; font-weight: 700; margin-bottom: 3rem; text-align: center;">${content.title}</h2>` : ''}
              ${content.stats && content.stats.length > 0 ? `
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 2rem; text-align: center;">
                  ${content.stats.map((stat: any) => `
                    <div>
                      <div style="font-size: 3.5rem; font-weight: 700; margin-bottom: 0.5rem;">${stat.value}</div>
                      <div style="font-size: 1.125rem; opacity: 0.9;">${stat.label}</div>
                      ${stat.description ? `<div style="font-size: 0.875rem; opacity: 0.7; margin-top: 0.5rem;">${stat.description}</div>` : ''}
                    </div>
                  `).join('')}
                </div>
              ` : ''}
            </div>
          </section>
        `;
      
      default:
        // Generic section conversion
        return `
          <section class="section-${sectionKey}" style="padding: 3rem 0;">
            ${content.title ? `<h2 style="font-size: 2rem; font-weight: 600; margin-bottom: 1rem;">${content.title}</h2>` : ''}
            ${content.description ? `<p style="color: #64748b; line-height: 1.6;">${content.description}</p>` : ''}
          </section>
        `;
    }
  };

  // Save content to backend
  const handleSave = async (editor: Editor | null) => {
    if (!editor) return;
    
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const html = editor.getHtml();
      const css = editor.getCss();

      // Save as a single "content" section with HTML/CSS
      const section: Omit<PageSection, 'id' | 'metadata'> = {
        pageKey: currentPageKey,
        sectionKey: 'content',
        content: {
          html: html,
          css: css,
        },
        isActive: true,
        sortOrder: 1,
      };

      try {
        // Try to update existing section
        await updatePageSection(token, currentPageKey, 'content', {
          content: section.content,
          isActive: true,
        });
      } catch (err: any) {
        // If update fails, try to create new section
        await savePageSection(token, section);
      }

      // Also clear local auto-save since we've saved
      localStorage.removeItem(`gjs-autosave-${currentPageKey}`);

      setSuccess('Page saved successfully!');
      setTimeout(() => setSuccess(null), 3000);
      onSave?.({ html, css, pageKey: currentPageKey });
    } catch (err: any) {
      console.error('Failed to save:', err);
      setError(err.message || 'Failed to save page');
      showAlert('Failed to save page: ' + (err.message || 'Unknown error'), 'error');
    } finally {
      setSaving(false);
    }
  };

  // Handle page change
  const handlePageChange = useCallback((newPageKey: string) => {
    if (newPageKey === currentPageKey) return;
    
    // Save current page before switching
    if (grapesEditorRef.current) {
      handleSave(grapesEditorRef.current);
    }
    
    setCurrentPageKey(newPageKey);
    setShowPageMenu(false);
    onPageChange?.(newPageKey);
    
    // Load new page content
    if (grapesEditorRef.current) {
      loadContent(grapesEditorRef.current);
    }
  }, [currentPageKey, onPageChange]);

  // Handle create new page
  const handleCreatePage = async () => {
    if (!newPageName.trim() || !onCreatePage) return;
    
    try {
      const newPage = await onCreatePage(newPageName.trim());
      setNewPageName('');
      setShowNewPageModal(false);
      handlePageChange(newPage.slug);
    } catch (err: any) {
      setError(err.message || 'Failed to create page');
    }
  };

  // Handle delete page
  const handleDeletePage = async (pageKeyToDelete: string) => {
    if (!onDeletePage) return;
    if (!window.confirm(`Are you sure you want to delete the page "${pageKeyToDelete}"? This cannot be undone.`)) return;
    
    try {
      await onDeletePage(pageKeyToDelete);
      if (pageKeyToDelete === currentPageKey && pages.length > 1) {
        const remainingPages = pages.filter(p => p.slug !== pageKeyToDelete);
        handlePageChange(remainingPages[0]?.slug || 'home');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete page');
    }
  };

  // Handle device change
  const handleDeviceChange = (device: 'Desktop' | 'Tablet' | 'Mobile') => {
    setActiveDevice(device);
    if (grapesEditorRef.current) {
      grapesEditorRef.current.setDevice(device);
    }
  };

  // Export HTML/CSS
  const handleExport = () => {
    if (!grapesEditorRef.current) return;
    const html = grapesEditorRef.current.getHtml();
    const css = grapesEditorRef.current.getCss();
    const fullHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${pageKey} Page</title>
  <style>${css}</style>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body style="margin: 0; padding: 0;">
${html}
</body>
</html>`;
    const blob = new Blob([fullHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${pageKey}-page.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import HTML
  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !grapesEditorRef.current) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const parser = new DOMParser();
      const doc = parser.parseFromString(content, 'text/html');
      const html = doc.body.innerHTML;
      const style = doc.querySelector('style')?.textContent || '';
      
      if (grapesEditorRef.current) {
        grapesEditorRef.current.setComponents(html);
        grapesEditorRef.current.setStyle(style);
      }
    };
    reader.readAsText(file);
  };

  // Copy HTML to clipboard
  const handleCopyHTML = () => {
    if (!grapesEditorRef.current) return;
    const html = grapesEditorRef.current.getHtml();
    navigator.clipboard.writeText(html).then(() => {
      setSuccess('HTML copied to clipboard!');
      setTimeout(() => setSuccess(null), 2000);
    });
  };

  // Copy CSS to clipboard
  const handleCopyCSS = () => {
    if (!grapesEditorRef.current) return;
    const css = grapesEditorRef.current.getCss();
    navigator.clipboard.writeText(css).then(() => {
      setSuccess('CSS copied to clipboard!');
      setTimeout(() => setSuccess(null), 2000);
    });
  };

  // Clear canvas
  const handleClear = () => {
    if (!grapesEditorRef.current) return;
    if (window.confirm('Are you sure you want to clear all content? This cannot be undone.')) {
      grapesEditorRef.current.setComponents('');
      grapesEditorRef.current.setStyle('');
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Custom Styles for GrapesJS to match OrbitAI design */}
      <style>{`
        .gjs-editor {
          background: #f8fafc;
        }
        .gjs-cv-canvas {
          background: white;
        }
        .gjs-pn-panel {
          background: white;
          border-color: #e2e8f0;
        }
        .gjs-pn-btn {
          color: #475569;
        }
        .gjs-pn-btn:hover {
          background: #f1f5f9;
          color: #0f172a;
        }
        .gjs-block {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 0.5rem;
          padding: 0.75rem;
          margin-bottom: 0.5rem;
          cursor: move;
        }
        .gjs-block:hover {
          border-color: #3b82f6;
          box-shadow: 0 1px 3px rgba(59, 130, 246, 0.1);
        }
        .gjs-sm-sector {
          border-color: #e2e8f0;
        }
        .gjs-sm-property {
          border-color: #e2e8f0;
        }
        .gjs-layer-item {
          color: #475569;
        }
        .gjs-layer-item:hover {
          background: #f1f5f9;
        }
        .gjs-selected {
          outline: 2px solid #3b82f6 !important;
        }
        .gjs-category-title {
          font-weight: 600;
          color: #0f172a;
          margin-top: 1rem;
          margin-bottom: 0.5rem;
          padding: 0.5rem;
          background: #f8fafc;
          border-radius: 0.25rem;
        }
      `}</style>

      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 bg-white border-b border-slate-200">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-bold text-slate-900">Page Editor</h2>
          
          {/* Page Selector Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowPageMenu(!showPageMenu)}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium text-slate-700 transition-colors"
            >
              <FileText size={16} />
              {currentPageKey}
              <ChevronDown size={14} />
            </button>
            
            {showPageMenu && (
              <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-lg shadow-lg border border-slate-200 z-50 overflow-hidden">
                <div className="p-2 border-b border-slate-100">
                  <span className="text-xs font-semibold text-slate-500 uppercase">Pages</span>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {pages.length > 0 ? (
                    pages.map((page) => (
                      <div
                        key={page.id}
                        className={`flex items-center justify-between px-3 py-2 hover:bg-slate-50 cursor-pointer ${
                          page.slug === currentPageKey ? 'bg-blue-50 text-blue-600' : 'text-slate-700'
                        }`}
                        onClick={() => handlePageChange(page.slug)}
                      >
                        <span className="font-medium">{page.name}</span>
                        {page.slug !== 'home' && onDeletePage && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeletePage(page.slug);
                            }}
                            className="text-slate-400 hover:text-red-500 p-1"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-slate-500 text-sm">
                      Editing: {currentPageKey}
                    </div>
                  )}
                </div>
                {onCreatePage && (
                  <div className="p-2 border-t border-slate-100">
                    <button
                      onClick={() => {
                        setShowPageMenu(false);
                        setShowNewPageModal(true);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg font-medium"
                    >
                      <Plus size={16} />
                      Create New Page
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Device Switcher */}
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
            <button
              onClick={() => handleDeviceChange('Desktop')}
              className={`p-1.5 rounded-md transition-colors ${
                activeDevice === 'Desktop' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'
              }`}
              title="Desktop"
            >
              <Monitor size={16} />
            </button>
            <button
              onClick={() => handleDeviceChange('Tablet')}
              className={`p-1.5 rounded-md transition-colors ${
                activeDevice === 'Tablet' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'
              }`}
              title="Tablet"
            >
              <Tablet size={16} />
            </button>
            <button
              onClick={() => handleDeviceChange('Mobile')}
              className={`p-1.5 rounded-md transition-colors ${
                activeDevice === 'Mobile' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'
              }`}
              title="Mobile"
            >
              <Smartphone size={16} />
            </button>
          </div>

          {/* Auto-save indicator */}
          {autoSaveEnabled && (
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <Settings size={12} className="animate-pulse" />
              Auto-save on
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {saving && (
            <div className="flex items-center gap-2 text-blue-600">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm">Saving...</span>
            </div>
          )}
          
          {success && (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle size={16} />
              <span className="text-sm">{success}</span>
            </div>
          )}
          
          {error && (
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle size={16} />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Undo/Redo */}
          <button
            onClick={() => grapesEditorRef.current?.runCommand('core:undo')}
            className="px-3 py-1.5 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-2"
            title="Undo"
          >
            <Undo2 size={16} />
          </button>
          <button
            onClick={() => grapesEditorRef.current?.runCommand('core:redo')}
            className="px-3 py-1.5 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-2"
            title="Redo"
          >
            <Redo2 size={16} />
          </button>

          {/* Code View Toggle */}
          <button
            onClick={() => {
              setShowCode(!showCode);
              if (!showCode) {
                updateCodeView();
              }
            }}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
              showCode 
                ? 'bg-blue-600 text-white hover:bg-blue-700' 
                : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
            }`}
            title="Code View"
          >
            <Code size={16} />
            Code
          </button>

          <button
            onClick={() => grapesEditorRef.current?.runCommand('preview-page')}
            className="px-3 py-1.5 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-2"
            title="Preview"
          >
            <Eye size={16} />
            Preview
          </button>

          <label className="px-3 py-1.5 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-2 cursor-pointer">
            <Upload size={16} />
            Import
            <input
              type="file"
              accept=".html"
              onChange={handleImport}
              className="hidden"
            />
          </label>

          <button
            onClick={handleExport}
            className="px-3 py-1.5 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-2"
            title="Export"
          >
            <Download size={16} />
            Export
          </button>

          <button
            onClick={handleClear}
            className="px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2"
            title="Clear All"
          >
            <Trash2 size={16} />
            Clear
          </button>

          <button
            onClick={() => handleSave(grapesEditorRef.current)}
            disabled={saving}
            className="px-4 py-1.5 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={16} />
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Code View Modal */}
      {showCode && (
        <div className="absolute inset-0 bg-white z-50 flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-slate-200">
            <h3 className="text-lg font-bold text-slate-900">Code Editor</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyHTML}
                className="px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-2"
              >
                <Copy size={14} />
                Copy HTML
              </button>
              <button
                onClick={handleCopyCSS}
                className="px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-2"
              >
                <Copy size={14} />
                Copy CSS
              </button>
              <button
                onClick={() => setShowCode(false)}
                className="px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
          <div className="flex-1 grid grid-cols-2 gap-4 p-4 overflow-auto">
            <div className="flex flex-col">
              <label className="text-sm font-semibold text-slate-700 mb-2">HTML</label>
              <textarea
                value={codeContent.html}
                onChange={(e) => {
                  setCodeContent({ ...codeContent, html: e.target.value });
                  if (grapesEditorRef.current) {
                    grapesEditorRef.current.setComponents(e.target.value);
                  }
                }}
                className="flex-1 font-mono text-sm p-4 border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                spellCheck={false}
              />
            </div>
            <div className="flex flex-col">
              <label className="text-sm font-semibold text-slate-700 mb-2">CSS</label>
              <textarea
                value={codeContent.css}
                onChange={(e) => {
                  setCodeContent({ ...codeContent, css: e.target.value });
                  if (grapesEditorRef.current) {
                    grapesEditorRef.current.setStyle(e.target.value);
                  }
                }}
                className="flex-1 font-mono text-sm p-4 border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                spellCheck={false}
              />
            </div>
          </div>
        </div>
      )}

      {/* GrapesJS Editor Container */}
      {!showCode && (
        <div className="flex-1 relative overflow-hidden">
          {loading && (
            <div className="absolute inset-0 bg-white z-50 flex items-center justify-center">
              <div className="text-center">
                <Loader2 className="mx-auto mb-4 text-blue-600 animate-spin" size={48} />
                <p className="text-slate-600 font-medium">Loading editor...</p>
              </div>
            </div>
          )}

          {/* GrapesJS Editor */}
          <div className="h-full flex">
            {/* Left Sidebar - Blocks */}
            <div className="w-64 bg-white border-r border-slate-200 flex flex-col">
              <div className="p-4 border-b border-slate-200">
                <h3 className="text-sm font-bold text-slate-900">Blocks</h3>
                <p className="text-xs text-slate-500 mt-1">Drag blocks to canvas</p>
              </div>
              <div className="flex-1 overflow-y-auto blocks__container p-4"></div>
            </div>

            {/* Center - Canvas */}
            <div className="flex-1 relative">
              {/* Device Switcher */}
              <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 panel__devices bg-white rounded-lg shadow-lg border border-slate-200 p-1 flex gap-1"></div>
              
              {/* Editor Canvas */}
              <div ref={editorRef} className="h-full"></div>
            </div>

            {/* Right Sidebar - Layers, Styles, Traits & Selectors */}
            <div className="w-80 bg-white border-l border-slate-200 flex flex-col">
              {/* Layers */}
              <div className="border-b border-slate-200 overflow-hidden flex flex-col" style={{ maxHeight: '25%' }}>
                <div className="p-3 border-b border-slate-200">
                  <h3 className="text-sm font-bold text-slate-900">Layers</h3>
                </div>
                <div className="flex-1 overflow-y-auto layers__container p-2"></div>
              </div>

              {/* Selectors */}
              <div className="border-b border-slate-200 overflow-hidden flex flex-col" style={{ maxHeight: '15%' }}>
                <div className="p-3 border-b border-slate-200">
                  <h3 className="text-sm font-bold text-slate-900">Selectors</h3>
                </div>
                <div className="flex-1 overflow-y-auto selectors__container p-2"></div>
              </div>

              {/* Traits */}
              <div className="border-b border-slate-200 overflow-hidden flex flex-col" style={{ maxHeight: '20%' }}>
                <div className="p-3 border-b border-slate-200">
                  <h3 className="text-sm font-bold text-slate-900">Properties</h3>
                </div>
                <div className="flex-1 overflow-y-auto traits__container p-2"></div>
              </div>

              {/* Styles */}
              <div className="flex-1 overflow-hidden flex flex-col">
                <div className="p-3 border-b border-slate-200">
                  <h3 className="text-sm font-bold text-slate-900">Styles</h3>
                </div>
                <div className="flex-1 overflow-y-auto styles__container p-2"></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Page Modal */}
      {showNewPageModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Create New Page</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Page Name</label>
              <input
                type="text"
                value={newPageName}
                onChange={(e) => setNewPageName(e.target.value)}
                placeholder="e.g., About Us, Contact, Services"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreatePage();
                  if (e.key === 'Escape') setShowNewPageModal(false);
                }}
              />
              <p className="text-xs text-slate-500 mt-1">
                The page slug will be automatically generated from the name.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowNewPageModal(false);
                  setNewPageName('');
                }}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePage}
                disabled={!newPageName.trim()}
                className="px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Page
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Click outside to close page menu */}
      {showPageMenu && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowPageMenu(false)}
        />
      )}
    </div>
  );
};

export default GrapesJSPageEditor;
