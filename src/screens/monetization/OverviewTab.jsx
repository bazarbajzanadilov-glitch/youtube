import Card from '../../components/ui/Card.jsx'
import sx from './MonetizationExtras.module.css'

const revenueSources = [
  { title: 'Реклама на странице просмотра', tone: 'orange', icon: 'watch' },
  { title: 'Реклама в ленте Shorts', tone: 'yellow', icon: 'shorts' },
  { title: 'Спонсорство', tone: 'green', icon: 'sponsor' },
  { title: 'Подарки', tone: 'teal', icon: 'gift' },
  { title: 'Supers', tone: 'purple', icon: 'super' },
]

const creatorTools = [
  'Скачать медиакит',
  'Служба поддержки авторов YouTube',
  'Инструмент поиска совпадений',
  'Конечные заставки видео',
]

const resourceGroups = [
  {
    title: 'Поддержка',
    links: ['Справочный центр', 'Форумы сообщества'],
  },
  {
    title: 'Всё о программе',
    links: ['Канал YouTube Creators'],
  },
  {
    title: 'Важная информация',
    links: [
      'Правила монетизации',
      'Правила в отношении контента, подходящего для монетизации',
      'Другие способы монетизации',
    ],
  },
]

export default function MonetizationOverviewTab({ activeSection = 'Обзор', onOpenAdmin }) {
  return (
    <div className={sx.partnerPage} data-active-section={activeSection}>
      <main className={sx.partnerMain}>
        <section className={sx.partnerIntro}>
          <h2>Вы – партнер YouTube</h2>
        </section>

        <section className={sx.partnerSection}>
          <h3>Ваши источники дохода</h3>
          <Card padding="none" depth="md" className={sx.sourceCard}>
            {revenueSources.map((source) => (
              <div className={sx.sourceRow} key={source.title}>
                <RevenueIcon icon={source.icon} tone={source.tone} />
                <span>{source.title}</span>
              </div>
            ))}
          </Card>
        </section>

        <section className={sx.partnerSection}>
          <h3>Больше способов заработка</h3>
          <Card padding="none" depth="md" className={sx.accordionCard}>
            <div className={sx.expandPanel}>
              <div className={sx.panelCopy}>
                <div className={sx.panelTop}>
                  <h4>Покупки</h4>
                  <span aria-hidden="true">⌃</span>
                </div>
                <strong>Зрители могут стать покупателями</strong>
                <p>
                  Продвигайте на канале товары из своего магазина или других брендов в рамках партнерской программы YouTube Покупок.
                </p>
                <button type="button" className={sx.whiteButton}>Включить рекламу</button>
              </div>
              <div className={sx.shoppingArt} aria-hidden="true">
                <span />
              </div>
            </div>
            <button type="button" className={sx.foldRow}>
              <span>Коллаборации</span>
              <span aria-hidden="true">⌄</span>
            </button>
          </Card>
        </section>

        <section className={sx.partnerSection}>
          <Card padding="none" depth="md" className={sx.infoCard}>
            <div className={sx.infoPanel}>
              <div className={sx.panelCopy}>
                <div className={sx.panelTop}>
                  <h3>Основное о монетизации</h3>
                </div>
                <h4>Сведения о доходе</h4>
                <p>
                  Посмотреть расчетный доход можно в YouTube Аналитике, а итоговую сумму к оплате за месяц - в AdSense.
                </p>
                <div className={sx.buttonRow}>
                  <button type="button" className={sx.whiteButton}>Подробнее</button>
                  <button type="button" className={sx.darkButton}>Скрыть</button>
                </div>
              </div>
              <div className={sx.analyticsArt} aria-hidden="true">
                <span />
              </div>
            </div>
            <button type="button" className={sx.foldRow}>
              <span>Помощь</span>
              <span aria-hidden="true">⌄</span>
            </button>
          </Card>
        </section>

        <section className={sx.partnerSection}>
          <h3>Ресурсы и инструменты для авторов</h3>
          <Card padding="lg" depth="md" className={sx.toolsCard}>
            {creatorTools.map((item) => (
              <button type="button" className={sx.toolLink} key={item}>
                <span className={sx.toolIcon} aria-hidden="true" />
                <span>{item}</span>
              </button>
            ))}
          </Card>
        </section>

        <section className={sx.partnerSection}>
          <h3>Ресурсы</h3>
          <Card padding="lg" depth="md" className={sx.resourcesCard}>
            {resourceGroups.map((group) => (
              <div className={sx.resourceGroup} key={group.title}>
                <h4>{group.title}</h4>
                {group.links.map((link) => (
                  <button type="button" key={link}>{link}</button>
                ))}
              </div>
            ))}
          </Card>
        </section>
      </main>

      <aside className={sx.partnerSide}>
        <Card padding="lg" depth="md" className={sx.sidePanel}>
          <h3>Настройка платежей</h3>
          <span className={sx.statusPill}>Выполняется</span>
          <div className={sx.sideBlock}>
            <h4>Что нужно сделать</h4>
            <strong>Пока действий от вас не требуется</strong>
            <p>
              Персональные данные подтверждены. Когда вы перейдете порог оплаты, мы сообщим о дальнейших действиях.
            </p>
          </div>
          <div className={sx.sideBlock}>
            <h4>Что дальше</h4>
            <p>Мы сообщим вам, когда нужно будет выбрать способ оплаты и завершить настройку.</p>
            <button type="button" className={sx.textLink}>Подробнее...</button>
          </div>
        </Card>

        <Card padding="lg" depth="md" className={sx.sidePanel}>
          <h3>Партнерская программа YouTube</h3>
          <div className={sx.sideBlock}>
            <h4>AdSense для YouTube</h4>
            <p>Идентификатор: pub-8534663269125491</p>
            <p>Связь установлена 3 мая 2026 г. в 03:17</p>
            <button type="button" className={sx.darkButton} onClick={onOpenAdmin}>Изменить</button>
          </div>
          <div className={sx.sideBlock}>
            <h4>Соглашения</h4>
            <p>
              Чтобы посмотреть принятые соглашения, в том числе условия Партнерской программы YouTube, нажмите кнопку ниже.
            </p>
            <button type="button" className={sx.darkButton}>Посмотреть соглашения</button>
          </div>
          <div className={sx.sideBlock}>
            <h4>Отказ от участия в Партнерской программе YouTube</h4>
            <p>В случае отказа вы лишитесь доступа к преимуществам программы. <button type="button" className={sx.inlineLink}>Подробнее</button></p>
            <button type="button" className={sx.darkButton}>Отказаться</button>
          </div>
        </Card>
      </aside>
    </div>
  )
}

function RevenueIcon({ icon, tone }) {
  return (
    <span className={`${sx.sourceIcon} ${sx[tone]}`} aria-hidden="true">
      {icon === 'watch' && (
        <svg viewBox="0 0 40 40" focusable="false">
          <path d="M11.5 28.5 15.2 11l10.6-3.1 2.7 1.6-4.1 18.6-10 4.2-2.9-3.8Z" />
          <path d="m18.2 12.7 5.8-1.8-2.8 13.4-5.7 2.4 2.7-14Z" />
          <path d="M23.7 15.7h6.1l-2.9 12.7-6.1 2.4 2.9-15.1Z" />
        </svg>
      )}
      {icon === 'shorts' && (
        <svg viewBox="0 0 40 40" focusable="false">
          <path d="M21.7 4 8 20.2h9.4L14.8 36 32 15.5h-9.8L24.9 4h-3.2Z" />
        </svg>
      )}
      {icon === 'sponsor' && (
        <svg viewBox="0 0 40 40" focusable="false">
          <path
            d="m20 6.5 4.1 8.4 9.2 1.3-6.6 6.5 1.5 9.1-8.2-4.3-8.2 4.3 1.5-9.1-6.6-6.5 9.2-1.3L20 6.5Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
        </svg>
      )}
      {icon === 'gift' && (
        <svg viewBox="0 0 40 40" focusable="false">
          <path d="M9.5 16.3h21v17.2h-21V16.3Z" />
          <path d="M7.5 12.3h25v5.2h-25v-5.2Z" />
          <path d="M18 12.3c-.5-2.6-1.7-4.7-3.7-4.7-1.5 0-2.8 1.2-2.8 2.7 0 1.6 1.4 2.5 3.4 2.5H18Z" />
          <path d="M22 12.3c.5-2.6 1.7-4.7 3.7-4.7 1.5 0 2.8 1.2 2.8 2.7 0 1.6-1.4 2.5-3.4 2.5H22Z" />
          <path d="M18 12.3h4v21.2h-4V12.3Z" fill="#0f0f0f" opacity=".7" />
        </svg>
      )}
      {icon === 'super' && (
        <svg viewBox="0 0 40 40" focusable="false">
          <path
            d="M20 8.2c6.1 0 11 4 11 9 0 3.1-1.9 5.8-4.8 7.4v5.2l-5.5-3.7H20c-6.1 0-11-4-11-8.9s4.9-9 11-9Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <path d="M14.3 16.3c1.8 2.4 3.7 3.6 5.7 3.6s3.9-1.2 5.7-3.6h-4.4L20 18l-1.3-1.7h-4.4Z" />
        </svg>
      )}
    </span>
  )
}
