# Business Sarthi — Database ER Diagram

```mermaid
erDiagram
    COMPANY ||--o{ USER : "employs"
    COMPANY }o--|| PACKAGE : "subscribes to"
    COMPANY ||--o{ LOCATION_LOG : "owns"
    COMPANY ||--o{ ATTENDANCE : "owns"
    COMPANY ||--o{ LEAVE : "owns"
    COMPANY ||--o{ PAYROLL : "owns"
    COMPANY ||--o{ SALE : "owns"
    COMPANY ||--o{ INVENTORY : "owns"
    COMPANY ||--o{ VENDOR : "owns"
    USER ||--o{ LOCATION_LOG : "pings"
    USER ||--o{ ATTENDANCE : "records"
    USER ||--o{ LEAVE : "applies"
    USER ||--o{ PAYROLL : "receives"
    USER ||--o{ SALE : "submits"
    USER ||--o{ NOTIFICATION : "receives"
    USER ||--o{ AUDIT_LOG : "performs"
    VENDOR ||--o{ INVENTORY : "supplies"
    INVENTORY ||--o{ SALE : "sold as"

    USER {
        ObjectId _id PK
        string name
        string email UK
        string password "bcrypt, select:false"
        enum role "SUPER_ADMIN|ADMIN_EMPLOYEE|COMPANY_OWNER|COMPANY_MANAGER|STAFF"
        enum subRole "ADMIN|HR|SUPPORT|FINANCE"
        ObjectId company FK
        string position
        number basicSalary
        number dailyAllowance
        number monthlyTarget
        object leaveBalance "paid, sick"
        array refreshTokens "hashed, select:false"
        bool isActive
        bool isEmailVerified
    }

    COMPANY {
        ObjectId _id PK
        string name
        string email UK
        string panVat
        string logo
        ObjectId package FK
        ObjectId owner FK
        enum status "ACTIVE|SUSPENDED|TRIAL"
        object settings "timezone, currency, workStartTime, lateGraceMinutes"
    }

    PACKAGE {
        ObjectId _id PK
        string name UK
        number price
        number maxStaff
        enum trackingIntervalMinutes "30|60|120"
        object features "5 boolean toggles"
        enum status "ACTIVE|INACTIVE"
    }

    LOCATION_LOG {
        ObjectId _id PK
        ObjectId staff FK
        ObjectId company FK
        geojson location "Point [lng,lat], 2dsphere"
        number accuracy
        number batteryLevel
        object deviceInfo
        date recordedAt "TTL 180d"
        enum source "BACKGROUND|CHECKIN|CHECKOUT|MANUAL"
    }

    ATTENDANCE {
        ObjectId _id PK
        ObjectId staff FK
        ObjectId company FK
        string date "YYYY-MM-DD, unique with staff"
        object checkIn "time, location, deviceInfo, isLate"
        object checkOut "time, location, deviceInfo"
        number workedMinutes
        enum status "PRESENT|ABSENT|HALF_DAY|ON_LEAVE|HOLIDAY"
    }

    LEAVE {
        ObjectId _id PK
        ObjectId staff FK
        ObjectId company FK
        enum type "PAID|UNPAID|SICK"
        date fromDate
        date toDate
        number days
        enum status "PENDING|APPROVED|REJECTED"
        ObjectId reviewedBy FK
    }

    PAYROLL {
        ObjectId _id PK
        ObjectId staff FK
        ObjectId company FK "null = system employee"
        string month "YYYY-MM, unique with staff"
        number basicSalary
        number allowance
        object deductions "absent, tax, other"
        number netSalary
        enum status "DRAFT|GENERATED|PAID"
    }

    SALE {
        ObjectId _id PK
        ObjectId company FK
        ObjectId staff FK
        ObjectId product FK "nullable"
        string productName
        number quantity
        number amount
        string customerName
        date saleDate
    }

    INVENTORY {
        ObjectId _id PK
        ObjectId company FK
        string productName
        string sku "unique with company"
        number quantity
        number costPrice
        number sellingPrice
        ObjectId vendor FK
        number reorderLevel
        array movements "IN|OUT|ADJUST history"
    }

    VENDOR {
        ObjectId _id PK
        ObjectId company FK
        string name
        string panVat
    }

    NOTIFICATION {
        ObjectId _id PK
        ObjectId recipient FK
        enum type "10 event types"
        bool isRead
        date createdAt "TTL 90d"
    }

    AUDIT_LOG {
        ObjectId _id PK
        ObjectId user FK
        ObjectId company FK
        string action
        string ip
        bool success
        date createdAt "TTL 365d"
    }
```

## Key Indexes

| Collection | Index | Purpose |
|---|---|---|
| users | `email` unique | login |
| users | `(company, role)`, `(company, isActive)` | tenant staff lists |
| locationlogs | `(staff, recordedAt desc)` | route history |
| locationlogs | `(company, recordedAt desc)` | live view / tenant export |
| locationlogs | `location 2dsphere` | geo queries / heatmap |
| locationlogs | `recordedAt` TTL 180d | volume control |
| attendance | `(staff, date)` unique | one record/day, dedupe |
| payroll | `(staff, month)` unique | one slip/month |
| sales | `(company, saleDate desc)`, `(company, staff, saleDate)` | analytics |
| inventory | `(company, sku)` unique | tenant SKU uniqueness |
| notifications | `(recipient, isRead, createdAt)` + TTL 90d | inbox |
| auditlogs | `(user/company/action, createdAt)` + TTL 365d | compliance |
