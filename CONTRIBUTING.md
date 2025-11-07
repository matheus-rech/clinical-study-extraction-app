# Contributing to Clinical Study Extraction System

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing.

## 🚀 Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/yourusername/clinical-study-extraction-app.git`
3. Create a branch: `git checkout -b feature/your-feature-name`
4. Make your changes
5. Test your changes
6. Commit: `git commit -m "Add your feature"`
7. Push: `git push origin feature/your-feature-name`
8. Open a Pull Request

## 📋 Development Setup

### Backend Development

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install pytest pytest-cov black flake8  # Dev dependencies
```

### Frontend Development

```bash
cd frontend
npm install
npm run dev
```

## 🧪 Testing

### Backend Tests

```bash
cd backend
pytest tests/ -v --cov=app
```

### Frontend Tests

```bash
cd frontend
npm test
npm run test:coverage
```

## 📝 Code Style

### Python
- Follow PEP 8
- Use Black for formatting: `black app/`
- Use flake8 for linting: `flake8 app/`
- Add type hints where appropriate

### JavaScript/React
- Follow ESLint rules
- Use Prettier for formatting
- Write meaningful component names
- Add PropTypes or TypeScript types

## 🐛 Bug Reports

When filing an issue, please include:
- Clear description of the bug
- Steps to reproduce
- Expected behavior
- Actual behavior
- Screenshots (if applicable)
- Environment details (OS, browser, Python/Node version)

## ✨ Feature Requests

When suggesting features:
- Describe the feature clearly
- Explain the use case
- Consider implementation complexity
- Discuss potential drawbacks

## 🔍 Code Review Process

1. All PRs require at least one review
2. Ensure all tests pass
3. Update documentation if needed
4. Keep PRs focused and small
5. Respond to feedback promptly

## 📚 Documentation

- Update README.md for new features
- Add docstrings to Python functions
- Comment complex logic
- Update API documentation

## 🙏 Thank You!

Your contributions help make this project better for everyone.
