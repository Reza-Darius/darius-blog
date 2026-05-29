import avatar from '../assets/images/avatar.jpg';
import hero from '../assets/images/hero.jpg';
import type { SiteConfig } from '../types';

const siteConfig: SiteConfig = {
    website: 'https://darius.dev',
    avatar: {
        src: avatar,
        alt: 'Ethan Donovan'
    },
    title: 'darius_dev',
    subtitle: 'Minimal Astro.js theme',
    description: 'Astro.js and Tailwind CSS theme for blog and portfolio by justgoodui.com',
    image: {
        src: '/dante-preview.jpg',
        alt: 'Dante - Astro.js and Tailwind CSS theme'
    },
    headerNavLinks: [
        {
            text: '/about',
            href: '/about'
        },
        {
            text: '/projects',
            href: '/projects'
        },
        {
            text: '/blog',
            href: '/blog'
        }
        // {
        //     text: 'Tags',
        //     href: '/tags'
        // }
    ],
    footerNavLinks: [
        {
            text: 'Contact',
            href: '/contact'
        },
        {
            text: 'Terms',
            href: '/terms'
        }
    ],
    socialLinks: [
        {
            text: 'GitHub',
            href: 'https://dribbble.com/'
        },
        {
            text: 'Instagram',
            href: 'https://instagram.com/'
        }
    ],
    hero: {
        title: "Hi I'm Darius, and I like art and programming",
        // text: "I'm **Ethan Donovan**, a web developer at Amazing Studio, dedicated to the realms of collaboration and artificial intelligence.\nMy approach involves embracing intuition, conducting just enough research, and leveraging aesthetics as a catalyst for exceptional products.\nI have a profound appreciation for top-notch software, visual design, and the principles of product-led growth.\n\nFeel free to explore some of my coding endeavors on [GitHub](https://github.com/JustGoodUI/dante-astro-theme) or follow me on [Twitter/X](https://twitter.com/justgoodui).",
        image: {
            src: hero,
            alt: 'A person sitting at a desk in front of a computer'
        },
        actions: [
            {
                text: '/contact',
                href: '/contact'
            }
        ]
    },
    subscribe: {
        enabled: false,
        title: "Subscribe to Darius' Newsletter",
        text: 'All the latest posts directly in your inbox.',
        form: {
            action: '#'
        }
    },
    postsPerPage: 8,
    projectsPerPage: 8
};

export default siteConfig;
