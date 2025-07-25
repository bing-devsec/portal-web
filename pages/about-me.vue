<template>
    <section class="container">
        <div class="about">
            <h2>Just about me</h2>
            <ul>
                <li><strong>1. 昵称：</strong><span class="selectable" @dblclick="selectText">{{ aboutMeData?.name || '' }}</span></li>
                <li><strong>2. 职业：</strong><span class="selectable" @dblclick="selectText">{{ aboutMeData?.job || '' }}</span></li>
                <li><strong>3. 工龄：</strong><span class="selectable" @dblclick="selectText">{{ aboutMeData?.workLife || '' }}</span></li>
                <li><strong>4. 定位：</strong><span class="selectable" @dblclick="selectText">{{ aboutMeData?.address || '' }}</span></li>
            </ul>
            <h2>About my website</h2>
            <ul>
                <li><strong>域名信息：</strong><span class="selectable" @dblclick="selectText">{{ aboutMeData?.domainInfo || '' }}</span></li>
                <li><strong>博客内容：</strong><span class="selectable" @dblclick="selectText">{{ aboutMeData?.blogContent || '' }}</span></li>
                <li><strong>本站定位：</strong><span class="selectable" @dblclick="selectText">{{ aboutMeData?.websiteLocation || '' }}</span></li>
                <li><strong>免责声明：</strong><span class="selectable" @dblclick="selectText">{{ aboutMeData?.statement || '' }}</span></li>
            </ul>
            <h2>Contact me</h2>
            <ul>
                <li v-for="(email, index) in aboutMeData?.email || []" :key="index">
                    <strong>{{ getEmailType(email) }}：</strong><a :href="'mailto:' + email">{{ email }}</a>
                </li>
            </ul>
        </div>
    </section>
</template>

<script setup lang="ts">
interface AboutMeData {
    name: string;
    job: string;
    workLife: string;
    address: string;
    domainInfo: string;
    blogContent: string;
    websiteLocation: string;
    statement: string;
    email: string[];
}

const aboutMe = ref<AboutMeData>({
    name: '',
    job: '',
    workLife: '',
    address: '',
    domainInfo: '',
    blogContent: '',
    websiteLocation: '',
    statement: '',
    email: []
});

const { data: aboutMeData } = useApiData<AboutMeData>('/user/about-me');

function selectText(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (target) {
        const range = document.createRange();
        range.selectNodeContents(target);
        const selection = window.getSelection();
        if (selection) {
            selection.removeAllRanges();
            selection.addRange(range);
        }
    }
}

function getEmailType(email: string): string {
    if (!email) return '邮箱';
    
    const domain = email.split('@')[1];
    const emailTypes: { [key: string]: string } = {
        'qq.com': 'QQ邮箱',
        '163.com': '网易邮箱',
        '126.com': '网易邮箱',
        'yeah.net': '网易邮箱',
        'sina.com': '新浪邮箱',
        'sohu.com': '搜狐邮箱',
        'aliyun.com': '阿里邮箱',
        'gmail.com': 'Gmail',
        'outlook.com': 'Outlook',
        'hotmail.com': 'Hotmail',
        'yahoo.com': 'Yahoo邮箱',
        'icloud.com': 'iCloud邮箱',
    };

    if (domain in emailTypes) {
        return emailTypes[domain];
    } else {
        const emails = aboutMe.value.email || [];
        return `邮箱${emails.indexOf(email) + 1}`;
    }
}
</script>

<style scoped>
.container:after {
    overflow-y: auto;
    content: "";
    display: block;
    clear: both;
}

.about_c,
.about {
    margin: 20px 20px;
}

.about h2:nth-of-type(1) {
    font-size: 28px;
    margin: -5px 0 15px 0;
}

.about h2 {
    font-size: 28px;
    margin: 35px 0 15px 0;
}

.about li {
    font-size: 14px;
    margin-bottom: 16px;
}

.about a:hover {
    color: #0056b3;
    text-decoration: underline;
}

@media(max-width: 576px) {
    .about {
        padding: 0 20px;
    }
    .about h2:nth-of-type(1) {
        font-size: 26px;
        margin: -10px 0 14px 0;
    }

    .about h2 {
        font-size: 26px;
        margin: 20px 0 14px 0;
    }

    .about li {
        font-size: 14px;
        margin-bottom: 12px;
    }
}
</style>