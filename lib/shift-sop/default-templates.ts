import type { RelatedModule, ShiftType, SopActionTemplate, SopActionType, SopSlotTemplate } from './types';

function a(
  id: string,
  text: string,
  actionType: SopActionType,
  extra?: { isRequired?: boolean; needProof?: boolean; relatedModule?: RelatedModule },
): SopActionTemplate {
  const isReq = extra?.isRequired ?? (actionType === 'required' || actionType === 'jump');
  return {
    id,
    actionText: text,
    actionType,
    isRequired: isReq,
    needProof: extra?.needProof ?? false,
    relatedModule: extra?.relatedModule ?? 'none',
    sort: 0,
  };
}

function slot(
  id: string,
  shiftType: ShiftType,
  startTime: string,
  endTime: string,
  moduleName: string,
  actions: SopActionTemplate[],
  sort: number,
): SopSlotTemplate {
  return {
    id,
    shiftType,
    startTime,
    endTime,
    moduleName,
    actions: actions.map((x, i) => ({ ...x, sort: i })),
    sort,
    enabled: true,
  };
}

/** 内置白班 / 晚班 SOP（可被管理员在本地模板覆盖） */
export function getBuiltinSopTemplates(): SopSlotTemplate[] {
  const day: SopSlotTemplate[] = [
    slot(
      'day-s1',
      'day',
      '08:00',
      '08:30',
      '早会与夜间清算',
      [
        a('day-s1-a1', '登录京东、拼多多、1688、淘宝、抖音等平台，将主账号分流至当前电脑', 'required'),
        a('day-s1-a2', '优先回复昨夜遗留消息和早晨客户留言', 'required'),
        a('day-s1-a3', '检查微信/企微，回复老客户消息', 'required', { relatedModule: 'old_crm' }),
      ],
      1,
    ),
    slot(
      'day-s2',
      'day',
      '08:30',
      '09:00',
      '弹药库准备',
      [
        a('day-s2-a1', '浏览各平台自家店铺当天最新活动、优惠券、主推款价格', 'guide'),
        a('day-s2-a2', '收集助理提供的素材，准备当天要发的视频号和朋友圈内容', 'guide'),
      ],
      2,
    ),
    slot(
      'day-s3',
      'day',
      '09:00',
      '10:30',
      '黄金追单期',
      [
        a(
          'day-s3-a1',
          '高意向跟进：对已发合同、待付款、昨晚聊得火热的客户电话或微信追单',
          'required',
          { needProof: false },
        ),
        a(
          'day-s3-a2',
          '素材触达：对观望期客户发送案例视频、质检报告、发货视频等价值内容，不要只问「买不买」',
          'guide',
        ),
      ],
      3,
    ),
    slot(
      'day-s4',
      'day',
      '10:30',
      '11:30',
      '线索流转与激活',
      [
        a(
          'day-s4-a1',
          '抖音留资处理：第一时间电联昨晚/今早抖音表单留资客户，并加微信',
          'jump',
          { relatedModule: 'lead_follow_douyin', needProof: true },
        ),
        a(
          'day-s4-a2',
          '流转电联：每日3个保底，拨打同事未成交流转客户，尝试破冰，并截图通话时长',
          'jump',
          { relatedModule: 'lead_follow_detail', needProof: true },
        ),
      ],
      4,
    ),
    slot(
      'day-s5',
      'day',
      '11:30',
      '12:30',
      '中午时间',
      [
        a('day-s5-a1', '轮流休息，保持平台不离线', 'guide'),
        a('day-s5-a2', '发布朋友圈/视频号：发布第一条朋友圈，并对重点客户朋友圈点赞评论', 'required'),
      ],
      5,
    ),
    slot(
      'day-s6',
      'day',
      '12:30',
      '14:00',
      '深度复盘与CRM',
      [
        a('day-s6-a1', '回看自己昨天未加到微信、未成交的聊天记录', 'required'),
        a('day-s6-a2', '思考未成交原因，并在「未成交询单反思」表填写（价格、信任、尺寸不合等）', 'jump', { relatedModule: 'lead_follow_no_deal' }),
        a('day-s6-a3', '整理客户档案，给微信客户打标签（如双室机、犹豫价格、预计下周定）', 'guide', { relatedModule: 'old_crm' }),
      ],
      6,
    ),
    slot(
      'day-s7',
      'day',
      '14:00',
      '15:30',
      '竞品假聊与情报',
      [
        a(
          'day-s7-a1',
          '每周一次假聊任务安排在此：选择本周单品，找3家竞品店铺假装客户套话',
          'jump',
          { relatedModule: 'competitor_weekly', needProof: true },
        ),
        a('day-s7-a2', '重点记录对方底价、送什么配件、保修承诺、话术亮点', 'required', { needProof: true }),
      ],
      7,
    ),
    slot(
      'day-s8',
      'day',
      '15:30',
      '16:30',
      '下午时段追单',
      [
        a('day-s8-a1', '针对上午没打通电话、没回微信的客户进行二次触达', 'required'),
        a('day-s8-a2', '处理日常发票开具对接、老客户售后问题拉群对接', 'guide'),
      ],
      8,
    ),
    slot(
      'day-s9',
      'day',
      '16:30',
      '17:30',
      '数据复盘与交接',
      [
        a(
          'day-s9-a1',
          '填写《日工作回执表》《数据汇总登记表》《评价登记分表》《日报》',
          'jump',
          { relatedModule: 'tasks_package' },
        ),
        a('day-s9-a2', '上传中台：电商客服数据中台日内容上传', 'jump', { relatedModule: 'kpi_daily' }),
        a(
          'day-s9-a3',
          '评价登记分表：在评价管理中完成当日登记',
          'jump',
          { relatedModule: 'reviews' },
        ),
        a('day-s9-a4', '标注明日优先跟进客户；若有晚班同事，做好特殊客户口头或留言交接', 'required'),
      ],
      9,
    ),
  ];

  const night: SopSlotTemplate[] = [
    slot(
      'night-s1',
      'night',
      '16:00',
      '16:30',
      '接班与早晚同步',
      [
        a('night-s1-a1', '登录平台接管分流', 'required'),
        a('night-s1-a2', '检查白班交接的重点跟进名单，熟悉今天当班的活动政策', 'required'),
      ],
      1,
    ),
    slot(
      'night-s2',
      'night',
      '16:30',
      '18:30',
      '晚高峰跟进',
      [
        a('night-s2-a1', '对处于跟进周期内的客户通过微信发送问候或机器资料', 'guide'),
        a('night-s2-a2', '接待各平台的正常晚间进线咨询', 'required'),
      ],
      2,
    ),
    slot(
      'night-s3',
      'night',
      '18:30',
      '19:30',
      '就餐与IP打造',
      [
        a('night-s3-a1', '工位就餐，保持接待', 'guide'),
        a(
          'night-s3-a2',
          '发布晚间朋友圈：第二条内容，如深夜加班发货、客户好评截图，打造靠谱人设',
          'guide',
        ),
      ],
      3,
    ),
    slot(
      'night-s4',
      'night',
      '19:30',
      '21:00',
      '线索流转与激活',
      [
        a(
          'night-s4-a1',
          '流转电联：每日3个保底；白天未打完须在本时段完成，最晚不要超过20:30，并带截图',
          'jump',
          { relatedModule: 'lead_follow_detail', needProof: true },
        ),
        a('night-s4-a2', '处理白天遗留的抖音留言', 'jump', { relatedModule: 'lead_follow_douyin' }),
      ],
      4,
    ),
    slot(
      'night-s5',
      'night',
      '21:00',
      '22:30',
      '竞品假聊与复盘',
      [
        a(
          'night-s5-a1',
          '执行当周竞品假聊任务：2～3家店铺',
          'jump',
          { relatedModule: 'competitor_weekly', needProof: true },
        ),
        a('night-s5-a2', '翻阅近期聊天记录，整理未成交原因，优化话术库', 'learning'),
      ],
      5,
    ),
    slot(
      'night-s6',
      'night',
      '22:30',
      '23:30',
      '静默接待与自学',
      [
        a('night-s6-a1', '坚守岗位接待深夜询单', 'required'),
        a('night-s6-a2', '熟悉机器操作手册、双室智能体，提升专业硬件知识', 'learning'),
      ],
      6,
    ),
    slot(
      'night-s7',
      'night',
      '23:30',
      '24:00',
      '数据统计与结班',
      [
        a(
          'night-s7-a1',
          '汇总当班数据，完成《日工作回执表》《数据汇总登记表》《评价登记分表》《日报》及中台上传',
          'jump',
          { relatedModule: 'tasks_package' },
        ),
        a('night-s7-a2', '将未处理的棘手问题留言给次日白班同事', 'required'),
      ],
      7,
    ),
  ];

  return [...day, ...night];
}
