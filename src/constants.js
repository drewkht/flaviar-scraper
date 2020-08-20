const LOGIN_URL = 'https://flaviar.com/login?popup&next_url=/';

const LOGIN_USERNAME_SELECTOR = `#global_modal_login > div > div > div > div.login_info_GlobalPopupLogin > div.row.pt-10 > div > div.memberdiv.hide > form > div:nth-child(1) > input`;

const LOGIN_PASSWORD_SELECTOR = `#global_modal_login > div > div > div > div.login_info_GlobalPopupLogin > div.row.pt-10 > div > div.memberdiv.hide > form > div:nth-child(3) > input`;

const LOGIN_SUBMIT_BUTTON_SELECTOR = `#global_modal_login > div > div > div > div.login_info_GlobalPopupLogin > div.row.pt-10 > div > div.memberdiv.hide > form > div.mt-10 > button`;

const BOTTLE_PAGE_BOTTLE_ITEM_SELECTOR = `div.col-lg-3 > a`;

module.exports = {
  LOGIN_URL,
  LOGIN_USERNAME_SELECTOR,
  LOGIN_PASSWORD_SELECTOR,
  LOGIN_SUBMIT_BUTTON_SELECTOR,
  BOTTLE_PAGE_BOTTLE_ITEM_SELECTOR,
};
