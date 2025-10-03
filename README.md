# 🍞 Starter Yeast

> The perfect fermentation starter for your Next.js applications

A modern, production-ready boilerplate that combines the best ingredients for building amazing web applications. Just like yeast transforms simple ingredients into delicious bread, Starter Yeast transforms your development process into something extraordinary.

## 🌟 What's Included

This boilerplate comes pre-configured with all the essential tools and components you need to start building immediately:

- **⚡ Next.js 15** - The latest React framework with App Router
- **🎨 Tailwind CSS 4** - Utility-first CSS framework
- **🧩 shadcn/ui** - Beautiful, accessible component library
- **🔐 Clerk** - Complete authentication solution
- **🌙 Dark Mode** - Built-in theme switching
- **📱 Mobile First** - Responsive design with collapsible sidebar
- **⚙️ TypeScript** - Type-safe development

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/your-username/starter-yeast.git
   cd starter-yeast
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   ```bash
   cp .env.example .env.local
   ```

   Add your Clerk keys to `.env.local`:

   ```env
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_publishable_key_here
   CLERK_SECRET_KEY=your_secret_key_here
   ```

4. **Start the development server**

   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:350](http://localhost:350) 🧪

> **Why port 350?** Just like the perfect temperature for yeast fermentation (350°F), this port ensures optimal development conditions!

## 🏗️ Project Structure

```
starter-yeast/
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── globals.css     # Global styles & theme variables
│   │   ├── layout.tsx      # Root layout with providers
│   │   └── page.tsx        # Landing page
│   ├── components/         # Reusable components
│   │   ├── ui/             # shadcn/ui components
│   │   ├── collapsible-sidebar.tsx
│   │   ├── theme-toggle.tsx
│   │   └── user-profile.tsx
│   └── lib/                # Utilities
│       └── utils.ts         # Tailwind class utilities
├── public/                 # Static assets
└── components.json         # shadcn/ui configuration
```

## 🎨 Features

### 🧪 Collapsible Sidebar

- **Desktop**: Collapsible sidebar with persistent state
- **Mobile**: Slide-out sidebar from the right
- **Responsive**: Adapts to all screen sizes
- **Persistence**: Remembers collapsed/expanded state

### 🌙 Theme System

- **System Preference**: Automatically detects light/dark mode
- **Manual Toggle**: Easy theme switching in sidebar
- **Smooth Transitions**: Beautiful animations between themes
- **Customizable**: Easy to modify colors in `globals.css`

### 🔐 Authentication Ready

- **Clerk Integration**: Complete auth solution
- **User Profile**: Avatar, name, email display
- **Sign In/Out**: Modal-based authentication
- **Protected Routes**: Ready for route protection

### 📱 Mobile Optimized

- **Touch Friendly**: Optimized for mobile interactions
- **Responsive Grid**: Adapts to all screen sizes
- **Mobile Sidebar**: Slide-out navigation
- **Performance**: Optimized for mobile devices

## 🛠️ Available Scripts

```bash
# Development server (port 350)
npm run dev

# Production build
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

## 🎯 Tech Stack Details

### Frontend

- **Next.js 15** - React framework with App Router
- **React 19** - Latest React with concurrent features
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS 4** - Utility-first CSS framework

### UI Components

- **shadcn/ui** - Accessible component library
- **Radix UI** - Headless component primitives
- **Lucide React** - Beautiful icon library

### Authentication

- **Clerk** - Complete authentication platform
- **Social Login** - Google, GitHub, etc.
- **User Management** - Profiles, settings, etc.

### Development

- **ESLint** - Code linting
- **Prettier** - Code formatting
- **Turbopack** - Fast bundling

## 🎨 Customization

### Colors & Themes

Modify the color scheme in `src/app/globals.css`:

```css
.dark {
  --background: oklch(0.129 0.042 264.695);
  --primary: oklch(0.929 0.013 255.508);
  /* Add your custom colors */
}
```

### Adding Components

Install new shadcn/ui components:

```bash
npx shadcn@latest add [component-name]
```

### Sidebar Customization

Modify `src/components/collapsible-sidebar.tsx` to add:

- Navigation items
- Custom sections
- Additional functionality

## 🚀 Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Connect to Vercel
3. Add environment variables
4. Deploy!

### Other Platforms

- **Netlify**: Works out of the box
- **Railway**: Easy deployment
- **Docker**: Container-ready

## 🤝 Contributing

We welcome contributions! Here's how to get started:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Next.js Team** - For the amazing framework
- **Tailwind CSS** - For the utility-first approach
- **shadcn/ui** - For the beautiful components
- **Clerk** - For the authentication solution
- **Vercel** - For the deployment platform

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/your-username/starter-yeast/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-username/starter-yeast/discussions)
- **Documentation**: [Wiki](https://github.com/your-username/starter-yeast/wiki)

---

**Happy Baking! 🍞**

_Starter Yeast v0.1.0 • Built with ❤️ for developers_
