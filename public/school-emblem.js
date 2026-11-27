const emblems = new Map([
  ["南京大学", "nju"], // https://historymuseum.nju.edu.cn/info/1061/21431.htm
  ["东南大学", "seu"], // https://www.seu.edu.cn/5/list.htm
  ["清华大学", "thu"], // https://vi.tsinghua.edu.cn/gk/xxbz/xh.htm
  ["北京大学", "pku"], // https://vim.pku.edu.cn/xzzq/
  ["浙江大学", "zju"], // https://www.zju.edu.cn/xxbs/list.htm
  ["上海交通大学", "sjtu"], // https://vi.sjtu.edu.cn/index.php/articles/base/1
  ["复旦大学", "fdu"], // https://www.fudan.edu.cn/2019/0505/c830a96310/page.htm
  ["中国科学技术大学", "ustc"], // https://djyszw.ustc.edu.cn/info/1070/6835.htm
  ["哈尔滨工业大学", "hit"], // https://www.hit.edu.cn/12254/list.htm
  ["北京航空航天大学", "buaa"], // https://xcb.buaa.edu.cn/info/1032/1631.htm
  ["华中科技大学", "hust"], // https://vi.hust.edu.cn/jcbf/bzgf/xhgf.htm
  ["武汉大学", "whu"], // https://www.whu.edu.cn/xxgk/wdbs.htm
  ["西安交通大学", "xjtu"], // https://www.xjtu.edu.cn/info/1024/5221.htm
  ["电子科技大学", "uestc"], // https://xxgkw.uestc.edu.cn/__local/A/23/FC/778741892D9413DA3A53590C170_C43C4EF6_A63B5.pdf
]);

export function schoolIdentity(schoolId, content, size = "") {
  const file = emblems.get(schoolId);
  if (!file) return content;
  const modifier = size ? ` school-emblem--${size}` : "";
  return `<span class="school-identity"><img class="school-emblem${modifier}" src="assets/school-emblems/${file}.png" alt="" decoding="async"><span>${content}</span></span>`;
}

document.addEventListener("error", ({ target }) => {
  if (target instanceof HTMLImageElement && target.matches(".school-emblem")) {
    target.remove();
  }
}, true);
