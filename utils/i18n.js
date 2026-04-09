const translations = {
    vi: {
        language: {
            label: 'Tiếng Việt',
            short: 'VI',
            switchLabel: 'Tiếng Việt'
        },
        currency: {
            label: 'VND'
        },
        top: {
            about: 'Về chúng tôi',
            contact: 'Liên hệ',
            help: 'Trợ giúp',
            faq: 'Câu hỏi thường gặp'
        },
        account: {
            dropdownLabel: 'Tài khoản',
            greeting: 'Xin chào',
            login: 'Đăng nhập',
            register: 'Đăng ký',
            logout: 'Đăng xuất'
        },
        nav: {
            home: 'Trang chủ',
            shop: 'Cửa hàng',
            detail: 'Chi tiết SP',
            pages: 'Trang',
            cart: 'Giỏ hàng',
            checkout: 'Thanh toán',
            contact: 'Liên hệ',
            categories: 'Danh mục',
            support: 'Hỗ trợ Khách hàng'
        },
        messages: {
            compareLimit: 'Bạn chỉ có thể so sánh tối đa 3 sản phẩm.',
            compareAdded: 'Đã thêm sản phẩm vào danh sách so sánh.',
            compareRemoved: 'Đã xóa sản phẩm khỏi danh sách so sánh.'
        }
    },
    en: {
        language: {
            label: 'English',
            short: 'EN',
            switchLabel: 'English'
        },
        currency: {
            label: 'VND'
        },
        top: {
            about: 'About us',
            contact: 'Contact',
            help: 'Support',
            faq: 'FAQ'
        },
        account: {
            dropdownLabel: 'Account',
            greeting: 'Hello',
            login: 'Log in',
            register: 'Sign up',
            logout: 'Log out'
        },
        nav: {
            home: 'Home',
            shop: 'Shop',
            detail: 'Product detail',
            pages: 'Pages',
            cart: 'Cart',
            checkout: 'Checkout',
            contact: 'Contact',
            categories: 'Categories',
            support: 'Customer Support'
        },
        messages: {
            compareLimit: 'You can compare at most 3 products.',
            compareAdded: 'Product added to compare list.',
            compareRemoved: 'Product removed from compare list.'
        }
    }
};

const SUPPORTED_LANGS = Object.keys(translations);

function getTranslation(lang = 'vi', key) {
    const safeLang = SUPPORTED_LANGS.includes(lang) ? lang : 'vi';
    const parts = key.split('.');
    let current = translations[safeLang];

    for (const part of parts) {
        if (current && Object.prototype.hasOwnProperty.call(current, part)) {
            current = current[part];
        } else {
            return key;
        }
    }
    return typeof current === 'string' ? current : key;
}

module.exports = {
    translations,
    SUPPORTED_LANGS,
    getTranslation
};

